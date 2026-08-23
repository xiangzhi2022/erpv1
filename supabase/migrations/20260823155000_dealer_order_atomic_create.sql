-- Create a dealer order and every item in one guarded database transaction.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select on table public.enterprises, public.orders to v2_function_owner;
grant insert on table public.orders, public.order_items to v2_function_owner;

create function public.create_dealer_order_with_items(
  target_enterprise_id uuid,
  target_factory_id uuid,
  target_order jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  order_date_text text := to_char((statement_timestamp() at time zone 'UTC')::date, 'YYYYMMDD');
  next_sequence integer;
  order_number text;
  order_row public.orders%rowtype;
  item_input jsonb;
  item_index integer := 0;
  item_quantity numeric;
  unit_price_yuan numeric;
  unit_price_cents numeric;
  subtotal_cents numeric;
  total_amount_cents numeric := 0;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if target_enterprise_id is null
    or target_factory_id is null
    or jsonb_typeof(target_order) is distinct from 'object'
    or target_order - array[
      'customer_name', 'customer_phone', 'delivery_date', 'remark', 'items'
    ] <> '{}'::jsonb
    or nullif(btrim(target_order ->> 'customer_name'), '') is null
    or char_length(target_order ->> 'customer_name') > 200
    or char_length(coalesce(target_order ->> 'customer_phone', '')) > 100
    or char_length(coalesce(target_order ->> 'remark', '')) > 2000
    or jsonb_typeof(target_order -> 'items') is distinct from 'array'
    or jsonb_array_length(target_order -> 'items') < 1
    or jsonb_array_length(target_order -> 'items') > 500 then
    raise exception using errcode = '22023', message = 'DEALER_ORDER_INPUT_INVALID';
  end if;

  if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.create')
    or not exists (
      select 1
      from public.enterprises dealer
      where dealer.id = target_enterprise_id
        and dealer.enterprise_type = 'dealer'
        and dealer.status = 'active'
    ) then
    raise exception using errcode = '42501', message = 'DEALER_ORDER_CREATE_FORBIDDEN';
  end if;
  if not exists (
    select 1
    from public.enterprises factory
    where factory.id = target_factory_id
      and factory.enterprise_type = 'manufacturer'
      and factory.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'DEALER_ORDER_FACTORY_INVALID';
  end if;

  for item_input in select value from jsonb_array_elements(target_order -> 'items')
  loop
    if jsonb_typeof(item_input) is distinct from 'object'
      or item_input - array[
        'product_name', 'specification', 'quantity', 'unit_price'
      ] <> '{}'::jsonb
      or nullif(btrim(item_input ->> 'product_name'), '') is null
      or char_length(item_input ->> 'product_name') > 200
      or char_length(coalesce(item_input ->> 'specification', '')) > 2000 then
      raise exception using errcode = '22023', message = 'DEALER_ORDER_ITEM_INVALID';
    end if;
    item_quantity := (item_input ->> 'quantity')::numeric;
    unit_price_yuan := (item_input ->> 'unit_price')::numeric;
    if item_quantity is null or item_quantity <= 0
      or unit_price_yuan is null or unit_price_yuan < 0 then
      raise exception using errcode = '22023', message = 'DEALER_ORDER_ITEM_INVALID';
    end if;
    unit_price_cents := pg_catalog.round(unit_price_yuan * 100);
    subtotal_cents := pg_catalog.round(unit_price_cents * item_quantity);
    if unit_price_cents < 0 or unit_price_cents <> trunc(unit_price_cents)
      or subtotal_cents < 0 or subtotal_cents <> trunc(subtotal_cents) then
      raise exception using errcode = '22023', message = 'DEALER_ORDER_ITEM_INVALID';
    end if;
    total_amount_cents := total_amount_cents + subtotal_cents;
  end loop;

  if total_amount_cents < 0 or total_amount_cents <> trunc(total_amount_cents) then
    raise exception using errcode = '22023', message = 'DEALER_ORDER_INPUT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_enterprise_id::text, 0)
  );
  select coalesce(max(right(existing_order.order_no, 4)::integer), 0) + 1
  into next_sequence
  from public.orders existing_order
  where existing_order.enterprise_id = target_enterprise_id
    and existing_order.order_no ~ ('^ORD' || order_date_text || '[0-9]{4}$');
  if next_sequence > 9999 then
    raise exception using errcode = '22023', message = 'DEALER_ORDER_SEQUENCE_EXHAUSTED';
  end if;
  order_number := 'ORD' || order_date_text || lpad(next_sequence::text, 4, '0');

  insert into public.orders (
    enterprise_id, order_no, customer_name, customer_phone, status, total_amount,
    target_factory_id, dealer_id, order_flow, from_enterprise_id,
    to_enterprise_id, delivery_date, remark, created_by, updated_at
  ) values (
    target_enterprise_id,
    order_number,
    btrim(target_order ->> 'customer_name'),
    nullif(btrim(target_order ->> 'customer_phone'), ''),
    'pending',
    total_amount_cents,
    target_factory_id,
    target_enterprise_id,
    'dealer_to_factory',
    target_enterprise_id,
    target_factory_id,
    nullif(target_order ->> 'delivery_date', '')::date,
    nullif(btrim(target_order ->> 'remark'), ''),
    actor_id,
    now()
  ) returning * into order_row;

  item_index := 0;
  for item_input in select value from jsonb_array_elements(target_order -> 'items')
  loop
    item_index := item_index + 1;
    item_quantity := (item_input ->> 'quantity')::numeric;
    unit_price_cents := pg_catalog.round((item_input ->> 'unit_price')::numeric * 100);
    subtotal_cents := pg_catalog.round(unit_price_cents * item_quantity);
    insert into public.order_items (
      enterprise_id, order_id, item_no, product_name, specifications, quantity,
      unit_price, subtotal, unit, sort_order, updated_at
    ) values (
      target_enterprise_id,
      order_row.id,
      order_number || '-I' || lpad(item_index::text, 2, '0'),
      btrim(item_input ->> 'product_name'),
      nullif(btrim(item_input ->> 'specification'), ''),
      item_quantity,
      unit_price_cents,
      subtotal_cents,
      '件',
      item_index,
      now()
    );
  end loop;

  return jsonb_build_object(
    'id', order_row.id,
    'order_no', order_row.order_no,
    'status', order_row.status
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'DEALER_ORDER_NUMBER_CONFLICT';
  when invalid_text_representation or numeric_value_out_of_range
    or datetime_field_overflow then
    raise exception using errcode = '22023', message = 'DEALER_ORDER_INPUT_INVALID';
end;
$$;

alter function public.create_dealer_order_with_items(uuid, uuid, jsonb)
  owner to v2_function_owner;
revoke all on function public.create_dealer_order_with_items(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.create_dealer_order_with_items(uuid, uuid, jsonb)
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
