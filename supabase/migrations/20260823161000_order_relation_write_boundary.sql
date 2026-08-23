-- Keep order workflow relationships and creation behind guarded RPCs.

revoke insert on table public.orders from authenticated;
revoke update on table public.orders from authenticated;
revoke delete on table public.orders from authenticated;
revoke insert (
  id, enterprise_id, order_no, customer_name, customer_phone,
  customer_address, order_source, status, total_amount, cost_amount,
  profit_amount, deposit_amount, target_factory_id, dealer_id,
  order_flow, from_enterprise_id, to_enterprise_id, parent_order_id,
  delivery_date, remark, internal_remark, created_by, created_at, updated_at
) on table public.orders from authenticated;
revoke update (
  id, enterprise_id, order_no, customer_name, customer_phone, customer_address,
  order_source, status, total_amount, cost_amount, profit_amount, deposit_amount,
  target_factory_id, dealer_id, order_flow, from_enterprise_id,
  to_enterprise_id, parent_order_id, delivery_date, remark, internal_remark,
  created_by, created_at, updated_at
) on table public.orders from authenticated;
grant update (
  customer_name,
  customer_phone,
  customer_address,
  order_source,
  delivery_date,
  remark,
  updated_at
) on table public.orders to authenticated;

-- Column grants are the first boundary. Enterprise-scoped RLS is retained as
-- defense in depth for the remaining non-relational direct updates.
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
for insert to authenticated
with check (
  app_private.has_enterprise_permission(orders.enterprise_id, 'orders.create')
);

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
for update to authenticated
using (
  app_private.has_enterprise_permission(orders.enterprise_id, 'orders.update')
)
with check (
  app_private.has_enterprise_permission(orders.enterprise_id, 'orders.update')
);

drop policy if exists orders_delete on public.orders;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select on table public.enterprises, public.orders to v2_function_owner;
grant insert on table public.orders to v2_function_owner;

create function public.create_basic_order(
  target_enterprise_id uuid,
  target_order jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  source_enterprise_type text;
  expected_flow text;
  target_flow text;
  parent_id uuid;
  order_number text;
  customer_name_value text;
  delivery_date_value date;
  created_order public.orders%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if target_enterprise_id is null
    or jsonb_typeof(target_order) is distinct from 'object'
    or target_order - array[
      'order_no', 'order_flow', 'parent_order_id', 'customer_name',
      'customer_phone', 'customer_address', 'delivery_date', 'remark'
    ] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'ORDER_BASIC_INPUT_INVALID';
  end if;
  if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.create') then
    raise exception using errcode = '42501', message = 'ORDER_BASIC_CREATE_FORBIDDEN';
  end if;

  order_number := nullif(btrim(target_order ->> 'order_no'), '');
  customer_name_value := nullif(btrim(target_order ->> 'customer_name'), '');
  target_flow := target_order ->> 'order_flow';
  parent_id := nullif(target_order ->> 'parent_order_id', '')::uuid;
  delivery_date_value := nullif(target_order ->> 'delivery_date', '')::date;
  if order_number is null
    or char_length(order_number) > 100
    or customer_name_value is null
    or char_length(customer_name_value) > 200
    or char_length(coalesce(target_order ->> 'customer_phone', '')) > 100
    or char_length(coalesce(target_order ->> 'customer_address', '')) > 1000
    or char_length(coalesce(target_order ->> 'remark', '')) > 2000
    or target_flow is null
    or target_flow not in ('dealer_to_factory', 'factory_to_supplier') then
    raise exception using errcode = '22023', message = 'ORDER_BASIC_INPUT_INVALID';
  end if;

  select enterprise.enterprise_type
  into source_enterprise_type
  from public.enterprises enterprise
  where enterprise.id = target_enterprise_id
    and enterprise.status = 'active';
  expected_flow := case source_enterprise_type
    when 'dealer' then 'dealer_to_factory'
    when 'manufacturer' then 'factory_to_supplier'
    else null
  end;
  if target_flow is distinct from expected_flow then
    raise exception using errcode = '42501', message = 'ORDER_BASIC_FLOW_FORBIDDEN';
  end if;

  if parent_id is not null and not exists (
    select 1
    from public.orders parent_order
    where parent_order.enterprise_id = target_enterprise_id
      and parent_order.id = parent_id
  ) then
    raise exception using errcode = 'P0002', message = 'PARENT_ORDER_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_enterprise_id::text, 0)
  );
  if exists (
    select 1
    from public.orders duplicate_order
    where duplicate_order.enterprise_id = target_enterprise_id
      and duplicate_order.order_no = order_number
  ) then
    raise exception using errcode = '23505', message = 'ORDER_NUMBER_CONFLICT';
  end if;

  insert into public.orders (
    enterprise_id,
    order_no,
    customer_name,
    customer_phone,
    customer_address,
    status,
    total_amount,
    target_factory_id,
    dealer_id,
    order_flow,
    from_enterprise_id,
    to_enterprise_id,
    parent_order_id,
    delivery_date,
    remark,
    created_by,
    updated_at
  ) values (
    target_enterprise_id,
    order_number,
    customer_name_value,
    nullif(btrim(target_order ->> 'customer_phone'), ''),
    nullif(btrim(target_order ->> 'customer_address'), ''),
    'pending',
    0,
    null,
    case when target_flow = 'dealer_to_factory' then target_enterprise_id else null end,
    target_flow,
    target_enterprise_id,
    null,
    parent_id,
    delivery_date_value,
    nullif(btrim(target_order ->> 'remark'), ''),
    actor_id,
    now()
  ) returning * into created_order;

  return pg_catalog.to_jsonb(created_order) - array[
    'cost_amount', 'profit_amount', 'deposit_amount', 'internal_remark'
  ];
exception
  when invalid_text_representation or datetime_field_overflow then
    raise exception using errcode = '22023', message = 'ORDER_BASIC_INPUT_INVALID';
  when unique_violation then
    raise exception using errcode = '23505', message = 'ORDER_NUMBER_CONFLICT';
end;
$$;

alter function public.create_basic_order(uuid, jsonb)
  owner to v2_function_owner;
revoke all on function public.create_basic_order(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.create_basic_order(uuid, jsonb)
  to authenticated;

revoke create on schema public from v2_function_owner;
do $$
begin
  if exists (
    select 1
    from pg_auth_members membership
    join pg_roles role on role.oid = membership.roleid
    join pg_roles member on member.oid = membership.member
    where role.rolname = 'v2_function_owner'
      and member.rolname = 'postgres'
  ) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
