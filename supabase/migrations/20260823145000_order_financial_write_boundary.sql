-- Keep finance-sensitive detail columns and order workflow state behind guarded RPCs.

revoke update on table public.orders from authenticated;
revoke insert on table public.orders from authenticated;
grant insert (
  id,
  enterprise_id,
  order_no,
  customer_name,
  customer_phone,
  customer_address,
  order_source,
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
  created_at,
  updated_at
) on table public.orders to authenticated;
grant update (
  order_no,
  customer_name,
  customer_phone,
  customer_address,
  order_source,
  target_factory_id,
  dealer_id,
  order_flow,
  from_enterprise_id,
  to_enterprise_id,
  parent_order_id,
  delivery_date,
  remark,
  updated_at
) on table public.orders to authenticated;

revoke update on table public.order_products from authenticated;
revoke insert on table public.order_products from authenticated;
grant insert (
  id,
  enterprise_id,
  order_id,
  space_id,
  product_no,
  product_name,
  product_type,
  product_model,
  width,
  height,
  depth,
  area,
  quantity,
  material,
  color,
  sort_order,
  remark,
  created_at,
  updated_at
) on table public.order_products to authenticated;
grant update (
  product_name,
  product_type,
  product_model,
  width,
  height,
  depth,
  area,
  quantity,
  material,
  color,
  status,
  sort_order,
  remark,
  updated_at
) on table public.order_products to authenticated;

revoke update on table public.order_items from authenticated;
revoke insert on table public.order_items from authenticated;
grant insert (
  id,
  enterprise_id,
  order_id,
  module_id,
  item_no,
  product_name,
  specifications,
  woodworking_craft,
  forming_craft,
  painting_craft,
  length_mm,
  width_mm,
  thickness_mm,
  quantity,
  unit,
  color,
  hardware,
  hardware_quantity,
  construction_surface,
  remark,
  sort_order,
  created_at,
  updated_at
) on table public.order_items to authenticated;
grant update (
  module_id,
  item_no,
  product_name,
  specifications,
  woodworking_craft,
  forming_craft,
  painting_craft,
  length_mm,
  width_mm,
  thickness_mm,
  quantity,
  unit,
  color,
  hardware,
  hardware_quantity,
  construction_surface,
  remark,
  sort_order,
  updated_at
) on table public.order_items to authenticated;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'draft',
    'pending',
    'submitted',
    'reviewed',
    'confirmed',
    'pool',
    'accepted',
    'producing',
    'partially_completed',
    'ready_to_ship',
    'shipped',
    'completed',
    'cancelled',
    'returned',
    'rejected',
    'withdrawn',
    'abnormal'
  )) not valid;

alter table public.orders validate constraint orders_status_check;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select, insert, update on table public.orders, public.order_products, public.order_items
  to v2_function_owner;
grant select on table public.order_spaces, public.order_modules to v2_function_owner;
grant insert on table public.order_status_logs to v2_function_owner;

create function app_private.create_order_product_with_pricing_internal(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_product jsonb
)
returns setof public.order_products
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  order_row public.orders%rowtype;
  created_product public.order_products%rowtype;
  quoted_amount numeric := coalesce((target_product ->> 'quoted_amount')::numeric, 0);
  cost_amount numeric := coalesce((target_product ->> 'cost_amount')::numeric, 0);
  profit_amount numeric := coalesce((target_product ->> 'profit_amount')::numeric, 0);
begin
  if actor_id is null or jsonb_typeof(target_product) <> 'object'
    or target_product - array[
      'space_id', 'product_no', 'product_name', 'product_type', 'product_model',
      'width', 'height', 'depth', 'area', 'quantity', 'material', 'color', 'status',
      'quoted_amount', 'cost_amount', 'profit_amount', 'sort_order', 'remark', 'internal_remark'
    ] <> '{}'::jsonb then
    raise exception 'ORDER_PRODUCT_INPUT_INVALID' using errcode = '22023';
  end if;

  select * into order_row
  from public.orders
  where enterprise_id = target_enterprise_id and id = target_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (
    app_private.has_enterprise_permission(target_enterprise_id, 'orders.create')
      and order_row.created_by = actor_id
      and order_row.status in ('draft', 'pending')
  ) and not (
    app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')
      and app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage')
  ) then
    raise exception 'ORDER_PRODUCT_CREATE_FORBIDDEN' using errcode = '42501';
  end if;
  if target_product ->> 'space_id' is null
    or nullif(target_product ->> 'product_no', '') is null
    or nullif(target_product ->> 'product_name', '') is null
    or quoted_amount < 0 or quoted_amount <> trunc(quoted_amount)
    or cost_amount < 0 or cost_amount <> trunc(cost_amount)
    or profit_amount <> trunc(profit_amount)
    or coalesce(nullif(target_product ->> 'status', ''), 'draft') not in ('draft', 'pending') then
    raise exception 'ORDER_PRODUCT_INPUT_INVALID' using errcode = '22023';
  end if;
  if (
    cost_amount <> 0
    or profit_amount <> 0
    or nullif(target_product ->> 'internal_remark', '') is not null
  ) and not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'ORDER_PRODUCT_FINANCE_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.order_spaces space_row
    where space_row.enterprise_id = target_enterprise_id
      and space_row.order_id = target_order_id
      and space_row.id = (target_product ->> 'space_id')::uuid
  ) then
    raise exception 'ORDER_PRODUCT_SPACE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.order_products (
    enterprise_id, order_id, space_id, product_no, product_name, product_type,
    product_model, width, height, depth, area, quantity, material, color, status,
    quoted_amount, cost_amount, profit_amount, sort_order, remark, internal_remark,
    updated_at
  ) values (
    target_enterprise_id,
    target_order_id,
    (target_product ->> 'space_id')::uuid,
    target_product ->> 'product_no',
    target_product ->> 'product_name',
    coalesce(nullif(target_product ->> 'product_type', ''), 'custom'),
    nullif(target_product ->> 'product_model', ''),
    (target_product ->> 'width')::numeric,
    (target_product ->> 'height')::numeric,
    (target_product ->> 'depth')::numeric,
    (target_product ->> 'area')::numeric,
    coalesce((target_product ->> 'quantity')::numeric, 1),
    nullif(target_product ->> 'material', ''),
    nullif(target_product ->> 'color', ''),
    coalesce(nullif(target_product ->> 'status', ''), 'draft'),
    quoted_amount,
    cost_amount,
    profit_amount,
    coalesce((target_product ->> 'sort_order')::integer, 1),
    nullif(target_product ->> 'remark', ''),
    nullif(target_product ->> 'internal_remark', ''),
    now()
  ) returning * into created_product;

  return next created_product;
end;
$$;

create function public.create_order_product_with_pricing(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_product jsonb
)
returns setof public.order_products
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'ORDER_PRODUCT_CREATE_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(target_product) <> 'object'
    or coalesce(nullif(target_product ->> 'status', ''), 'draft') <> 'draft' then
    raise exception 'ORDER_PRODUCT_INPUT_INVALID' using errcode = '22023';
  end if;
  if target_product ?| array['quoted_amount', 'cost_amount', 'profit_amount', 'internal_remark']
    and not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'ORDER_PRODUCT_FINANCE_FORBIDDEN' using errcode = '42501';
  end if;
  return query select * from app_private.create_order_product_with_pricing_internal(
    target_enterprise_id,
    target_order_id,
    target_product
  );
end;
$$;

create function public.create_order_item_with_pricing(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_item jsonb
)
returns setof public.order_items
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  order_row public.orders%rowtype;
  created_item public.order_items%rowtype;
  unit_price numeric := coalesce((target_item ->> 'unit_price')::numeric, 0);
  subtotal numeric := coalesce((target_item ->> 'subtotal')::numeric, 0);
begin
  if actor_id is null or jsonb_typeof(target_item) <> 'object'
    or target_item - array[
      'module_id', 'item_no', 'product_name', 'specifications', 'woodworking_craft',
      'forming_craft', 'painting_craft', 'length_mm', 'width_mm', 'thickness_mm',
      'quantity', 'unit', 'color', 'hardware', 'hardware_quantity',
      'construction_surface', 'unit_price', 'subtotal', 'remark', 'sort_order'
    ] <> '{}'::jsonb then
    raise exception 'ORDER_ITEM_INPUT_INVALID' using errcode = '22023';
  end if;

  select * into order_row
  from public.orders
  where enterprise_id = target_enterprise_id and id = target_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (
    app_private.has_enterprise_permission(target_enterprise_id, 'orders.create')
      and order_row.created_by = actor_id
      and order_row.status in ('draft', 'pending')
  ) and not (
    app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')
      and app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage')
  ) then
    raise exception 'ORDER_ITEM_CREATE_FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(target_item ->> 'product_name', '') is null
    or unit_price < 0 or unit_price <> trunc(unit_price)
    or subtotal < 0 or subtotal <> trunc(subtotal) then
    raise exception 'ORDER_ITEM_INPUT_INVALID' using errcode = '22023';
  end if;
  if target_item ->> 'module_id' is not null and not exists (
    select 1
    from public.order_modules module_row
    where module_row.enterprise_id = target_enterprise_id
      and module_row.order_id = target_order_id
      and module_row.id = (target_item ->> 'module_id')::uuid
  ) then
    raise exception 'ORDER_ITEM_MODULE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.order_items (
    enterprise_id, order_id, module_id, item_no, product_name, specifications,
    woodworking_craft, forming_craft, painting_craft, length_mm, width_mm,
    thickness_mm, quantity, unit, color, hardware, hardware_quantity,
    construction_surface, unit_price, subtotal, remark, sort_order, updated_at
  ) values (
    target_enterprise_id,
    target_order_id,
    (target_item ->> 'module_id')::uuid,
    nullif(target_item ->> 'item_no', ''),
    target_item ->> 'product_name',
    nullif(target_item ->> 'specifications', ''),
    nullif(target_item ->> 'woodworking_craft', ''),
    nullif(target_item ->> 'forming_craft', ''),
    nullif(target_item ->> 'painting_craft', ''),
    (target_item ->> 'length_mm')::numeric,
    (target_item ->> 'width_mm')::numeric,
    (target_item ->> 'thickness_mm')::numeric,
    coalesce((target_item ->> 'quantity')::numeric, 1),
    coalesce(nullif(target_item ->> 'unit', ''), '件'),
    nullif(target_item ->> 'color', ''),
    nullif(target_item ->> 'hardware', ''),
    (target_item ->> 'hardware_quantity')::numeric,
    nullif(target_item ->> 'construction_surface', ''),
    unit_price,
    subtotal,
    nullif(target_item ->> 'remark', ''),
    coalesce((target_item ->> 'sort_order')::integer, 1),
    now()
  ) returning * into created_item;

  return next created_item;
end;
$$;

create function public.finance_update_order_product(
  target_enterprise_id uuid,
  target_product_id uuid,
  target_quoted_amount numeric default null,
  target_cost_amount numeric default null,
  target_profit_amount numeric default null,
  target_internal_remark text default null,
  update_internal_remark boolean default false
)
returns setof public.order_products
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_product public.order_products%rowtype;
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'ORDER_PRODUCT_FINANCE_FORBIDDEN' using errcode = '42501';
  end if;
  if (target_quoted_amount is not null and (
      target_quoted_amount < 0 or target_quoted_amount <> trunc(target_quoted_amount)
    ))
    or (target_cost_amount is not null and (
      target_cost_amount < 0 or target_cost_amount <> trunc(target_cost_amount)
    ))
    or (target_profit_amount is not null and target_profit_amount <> trunc(target_profit_amount)) then
    raise exception 'INVALID_CENTS_AMOUNT' using errcode = '22023';
  end if;

  update public.order_products
  set quoted_amount = coalesce(target_quoted_amount, quoted_amount),
      cost_amount = coalesce(target_cost_amount, cost_amount),
      profit_amount = coalesce(target_profit_amount, profit_amount),
      internal_remark = case
        when update_internal_remark then target_internal_remark
        else internal_remark
      end,
      updated_at = now()
  where enterprise_id = target_enterprise_id
    and id = target_product_id
  returning * into updated_product;

  if not found then
    raise exception 'ORDER_PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;
  return next updated_product;
end;
$$;

create function public.finance_update_order_item_pricing(
  target_enterprise_id uuid,
  target_order_item_id uuid,
  target_unit_price numeric default null,
  target_subtotal numeric default null
)
returns setof public.order_items
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_item public.order_items%rowtype;
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'ORDER_ITEM_FINANCE_FORBIDDEN' using errcode = '42501';
  end if;
  if (target_unit_price is not null and (
      target_unit_price < 0 or target_unit_price <> trunc(target_unit_price)
    ))
    or (target_subtotal is not null and (
      target_subtotal < 0 or target_subtotal <> trunc(target_subtotal)
    )) then
    raise exception 'INVALID_CENTS_AMOUNT' using errcode = '22023';
  end if;

  update public.order_items
  set unit_price = coalesce(target_unit_price, unit_price),
      subtotal = coalesce(target_subtotal, subtotal),
      updated_at = now()
  where enterprise_id = target_enterprise_id
    and id = target_order_item_id
  returning * into updated_item;

  if not found then
    raise exception 'ORDER_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  return next updated_item;
end;
$$;

create function public.update_order_internal_remark(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_internal_remark text
)
returns setof public.orders
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_order public.orders%rowtype;
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'ORDER_INTERNAL_REMARK_FORBIDDEN' using errcode = '42501';
  end if;

  update public.orders
  set internal_remark = target_internal_remark,
      updated_at = now()
  where enterprise_id = target_enterprise_id
    and id = target_order_id
  returning * into updated_order;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return next updated_order;
end;
$$;

create function public.transition_order_status(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_expected_status text,
  target_status text,
  target_remark text default null
)
returns table (
  id uuid,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  existing_order public.orders%rowtype;
  updated_order public.orders%rowtype;
  allowed boolean := false;
begin
  if actor_id is null then
    raise exception 'ORDER_STATUS_AUTH_REQUIRED' using errcode = '42501';
  end if;

  select *
  into existing_order
  from public.orders order_target
  where order_target.enterprise_id = target_enterprise_id
    and order_target.id = target_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if existing_order.status <> target_expected_status then
    raise exception 'ORDER_STATUS_CONFLICT' using errcode = 'P0001';
  end if;
  if target_status = target_expected_status then
    raise exception 'ORDER_STATUS_TRANSITION_INVALID' using errcode = 'P0001';
  end if;
  if target_status not in (
    'draft', 'pending', 'submitted', 'reviewed', 'confirmed', 'pool', 'accepted',
    'producing', 'partially_completed', 'ready_to_ship', 'shipped', 'completed',
    'cancelled', 'returned', 'rejected', 'withdrawn', 'abnormal'
  ) then
    raise exception 'ORDER_STATUS_INVALID' using errcode = '22023';
  end if;
  if not (
    (target_expected_status = 'draft' and target_status in ('pending', 'cancelled'))
    or (target_expected_status = 'pending' and target_status in ('submitted', 'confirmed', 'accepted', 'returned', 'cancelled'))
    or (target_expected_status = 'submitted' and target_status in ('reviewed', 'accepted', 'returned', 'cancelled'))
    or (target_expected_status = 'reviewed' and target_status in ('confirmed', 'accepted', 'returned', 'cancelled'))
    or (target_expected_status = 'confirmed' and target_status in ('pool', 'cancelled'))
    or (target_expected_status = 'accepted' and target_status in ('pool', 'producing', 'returned', 'cancelled'))
    or (target_expected_status = 'returned' and target_status in ('pending', 'cancelled'))
    or (target_expected_status = 'pool' and target_status in ('producing', 'cancelled', 'abnormal'))
    or (target_expected_status = 'producing' and target_status in ('partially_completed', 'ready_to_ship', 'shipped', 'completed', 'cancelled', 'abnormal'))
    or (target_expected_status = 'partially_completed' and target_status in ('producing', 'ready_to_ship', 'cancelled', 'abnormal'))
    or (target_expected_status = 'ready_to_ship' and target_status in ('shipped', 'completed', 'cancelled', 'abnormal'))
    or (target_expected_status = 'shipped' and target_status in ('completed', 'returned'))
    or (target_expected_status = 'abnormal' and target_status in ('producing', 'cancelled'))
    or (target_expected_status = 'rejected' and target_status in ('pending', 'cancelled'))
  ) then
    raise exception 'ORDER_STATUS_TRANSITION_INVALID' using errcode = 'P0001';
  end if;

  allowed := case
    when target_status = 'confirmed'
      and existing_order.target_factory_id = target_enterprise_id
      then app_private.has_enterprise_permission(target_enterprise_id, 'orders.accept')
    when target_status in ('accepted', 'reviewed')
      then app_private.has_enterprise_permission(target_enterprise_id, 'orders.accept')
    when target_status = 'pool'
      then app_private.has_enterprise_permission(target_enterprise_id, 'production.plan')
    when target_status in ('producing', 'partially_completed', 'ready_to_ship', 'abnormal')
      then app_private.has_enterprise_permission(target_enterprise_id, 'production.manage')
    when target_status = 'shipped'
      then app_private.has_enterprise_permission(target_enterprise_id, 'shipping.manage')
    else app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')
  end;

  if not allowed then
    raise exception 'ORDER_STATUS_FORBIDDEN' using errcode = '42501';
  end if;

  update public.orders as order_target
  set status = target_status,
      updated_at = now()
  where order_target.enterprise_id = target_enterprise_id
    and order_target.id = target_order_id
    and order_target.status = target_expected_status
  returning * into updated_order;

  if not found then
    raise exception 'ORDER_STATUS_CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.order_status_logs (
    enterprise_id,
    target_type,
    target_id,
    from_status,
    to_status,
    changed_by,
    remark
  ) values (
    target_enterprise_id,
    'order',
    target_order_id,
    target_expected_status,
    target_status,
    actor_id,
    target_remark
  );

  return query
  select updated_order.id, updated_order.status, updated_order.updated_at;
end;
$$;

alter function public.create_order_product_with_pricing(uuid, uuid, jsonb)
  owner to v2_function_owner;
alter function app_private.create_order_product_with_pricing_internal(uuid, uuid, jsonb)
  owner to v2_function_owner;
alter function public.create_order_item_with_pricing(uuid, uuid, jsonb)
  owner to v2_function_owner;
alter function public.finance_update_order_product(uuid, uuid, numeric, numeric, numeric, text, boolean)
  owner to v2_function_owner;
alter function public.finance_update_order_item_pricing(uuid, uuid, numeric, numeric)
  owner to v2_function_owner;
alter function public.update_order_internal_remark(uuid, uuid, text)
  owner to v2_function_owner;
alter function public.transition_order_status(uuid, uuid, text, text, text)
  owner to v2_function_owner;

revoke all on function public.create_order_product_with_pricing(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function app_private.create_order_product_with_pricing_internal(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.create_order_item_with_pricing(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.finance_update_order_product(uuid, uuid, numeric, numeric, numeric, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.finance_update_order_item_pricing(uuid, uuid, numeric, numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.update_order_internal_remark(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.transition_order_status(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.create_order_product_with_pricing(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.create_order_item_with_pricing(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.finance_update_order_product(uuid, uuid, numeric, numeric, numeric, text, boolean)
  to authenticated;
grant execute on function public.finance_update_order_item_pricing(uuid, uuid, numeric, numeric)
  to authenticated;
grant execute on function public.update_order_internal_remark(uuid, uuid, text)
  to authenticated;
grant execute on function public.transition_order_status(uuid, uuid, text, text, text)
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
