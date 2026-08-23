-- Keep basic order fields and the draft reset in one guarded transaction.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select on table public.enterprises to v2_function_owner;
grant select, update on table public.orders to v2_function_owner;

create function public.update_basic_order(
  target_enterprise_id uuid,
  target_order_id uuid,
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
  previous_order public.orders%rowtype;
  updated_order public.orders%rowtype;
  transitioned_order_id uuid;
  order_number text;
  customer_name_value text;
  target_flow text;
  parent_id uuid;
  delivery_date_value date;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.update') then
    raise exception using errcode = '42501', message = 'ORDER_UPDATE_FORBIDDEN';
  end if;
  if target_enterprise_id is null
    or target_order_id is null
    or jsonb_typeof(target_order) <> 'object'
    or target_order - array[
      'order_no', 'order_flow', 'parent_order_id', 'customer_name',
      'customer_phone', 'customer_address', 'delivery_date', 'remark'
    ] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'ORDER_BASIC_INPUT_INVALID';
  end if;

  order_number := nullif(btrim(target_order ->> 'order_no'), '');
  customer_name_value := nullif(btrim(target_order ->> 'customer_name'), '');
  target_flow := target_order ->> 'order_flow';
  parent_id := nullif(target_order ->> 'parent_order_id', '')::uuid;
  delivery_date_value := nullif(target_order ->> 'delivery_date', '')::date;
  if order_number is null
    or customer_name_value is null
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

  select *
  into previous_order
  from public.orders existing_order
  where existing_order.enterprise_id = target_enterprise_id
    and existing_order.id = target_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  update public.orders order_target
  set order_no = order_number,
      customer_name = customer_name_value,
      customer_phone = nullif(btrim(target_order ->> 'customer_phone'), ''),
      customer_address = nullif(btrim(target_order ->> 'customer_address'), ''),
      delivery_date = delivery_date_value,
      remark = nullif(btrim(target_order ->> 'remark'), ''),
      dealer_id = case when target_flow = 'dealer_to_factory' then target_enterprise_id else null end,
      order_flow = target_flow,
      from_enterprise_id = target_enterprise_id,
      to_enterprise_id = null,
      target_factory_id = null,
      parent_order_id = parent_id,
      updated_at = now()
  where order_target.enterprise_id = target_enterprise_id
    and order_target.id = target_order_id
  returning * into updated_order;

  if previous_order.status <> 'pending' then
    select status_update.id
    into strict transitioned_order_id
    from public.transition_order_status(
      target_enterprise_id,
      target_order_id,
      previous_order.status,
      'pending',
      '保存订单基础信息'
    ) status_update;

    select *
    into updated_order
    from public.orders saved_order
    where saved_order.enterprise_id = target_enterprise_id
      and saved_order.id = target_order_id;
  end if;

  return pg_catalog.to_jsonb(updated_order) - array[
    'cost_amount', 'profit_amount', 'deposit_amount', 'internal_remark'
  ];
end;
$$;

alter function public.update_basic_order(uuid, uuid, jsonb)
  owner to v2_function_owner;
revoke all on function public.update_basic_order(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.update_basic_order(uuid, uuid, jsonb)
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
