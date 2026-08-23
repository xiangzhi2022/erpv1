-- Structural writes must be serialized with the parent order workflow.
revoke insert, update on table public.order_spaces from authenticated;
revoke insert, update on table public.order_modules from authenticated;
revoke insert, update on table public.order_items from authenticated;
revoke insert, update on table public.order_products from authenticated;
revoke insert, update, delete on table public.order_item_attachments from authenticated;

drop policy if exists order_spaces_insert on public.order_spaces;
drop policy if exists order_spaces_update on public.order_spaces;
drop policy if exists order_modules_insert on public.order_modules;
drop policy if exists order_modules_update on public.order_modules;
drop policy if exists order_items_insert on public.order_items;
drop policy if exists order_items_update on public.order_items;
drop policy if exists order_products_insert on public.order_products;
drop policy if exists order_products_update on public.order_products;
drop policy if exists order_item_attachments_insert on public.order_item_attachments;
drop policy if exists order_item_attachments_update on public.order_item_attachments;
drop policy if exists order_item_attachments_delete on public.order_item_attachments;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;
grant create on schema public to v2_function_owner;
grant select on table public.orders, public.order_spaces, public.order_modules to v2_function_owner;
grant select, insert, update on table public.order_spaces, public.order_products, public.order_items
  to v2_function_owner;

drop function if exists public.create_order_product_with_pricing(uuid, uuid, jsonb);
drop function if exists public.create_order_item_with_pricing(uuid, uuid, jsonb);

create function public.create_order_space(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_space jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  order_row public.orders%rowtype;
  created_space public.order_spaces%rowtype;
  next_index integer;
begin
  if auth.uid() is null or jsonb_typeof(target_space) <> 'object'
    or target_space = '{}'::jsonb
    or target_space - array['space_name', 'space_type', 'sort_order', 'remark'] <> '{}'::jsonb
    or nullif(btrim(target_space ->> 'space_name'), '') is null
    or char_length(target_space ->> 'space_name') > 200
    or char_length(coalesce(target_space ->> 'space_type', '')) > 100
    or char_length(coalesce(target_space ->> 'remark', '')) > 2000
    or (target_space ? 'sort_order' and (
      jsonb_typeof(target_space -> 'sort_order') <> 'number'
      or (target_space ->> 'sort_order')::numeric <> trunc((target_space ->> 'sort_order')::numeric)
      or (target_space ->> 'sort_order')::numeric < 0
    )) then
    raise exception using errcode = '22023', message = 'ORDER_SPACE_INPUT_INVALID';
  end if;
  if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.update') then
    raise exception using errcode = '42501', message = 'ORDER_COMPONENT_WRITE_FORBIDDEN';
  end if;
  select * into order_row from public.orders
  where enterprise_id = target_enterprise_id and id = target_order_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  if order_row.status not in ('draft', 'pending', 'returned', 'rejected') then
    raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT';
  end if;
  select coalesce(max(case
    when char_length(substring(space_no from '-S([0-9]+)$')) <= 9
      then (substring(space_no from '-S([0-9]+)$'))::integer
    else null
  end), 0) + 1
  into next_index from public.order_spaces
  where enterprise_id = target_enterprise_id and order_id = target_order_id;
  insert into public.order_spaces (
    enterprise_id, order_id, space_no, space_name, space_type, sort_order, remark, updated_at
  ) values (
    target_enterprise_id, target_order_id,
    order_row.order_no || '-S' || lpad(next_index::text, 2, '0'),
    btrim(target_space ->> 'space_name'), nullif(btrim(target_space ->> 'space_type'), ''),
    coalesce((target_space ->> 'sort_order')::integer, next_index),
    nullif(btrim(target_space ->> 'remark'), ''), now()
  ) returning * into created_space;
  return to_jsonb(created_space);
end;
$$;

create or replace function app_private.create_order_product_with_pricing_internal(
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
  space_row public.order_spaces%rowtype;
  created_product public.order_products%rowtype;
  next_index integer;
  quoted_amount numeric := 0;
  cost_amount numeric := 0;
  profit_amount numeric := 0;
begin
  if actor_id is null or jsonb_typeof(target_product) <> 'object'
    or target_product - array[
      'space_id', 'product_no', 'product_name', 'product_type', 'product_model',
      'width', 'height', 'depth', 'area', 'quantity', 'material', 'color', 'status',
      'quoted_amount', 'cost_amount', 'profit_amount', 'sort_order', 'remark', 'internal_remark'
    ] <> '{}'::jsonb
    or nullif(target_product ->> 'space_id', '') is null
    or nullif(btrim(target_product ->> 'product_name'), '') is null
    or coalesce(nullif(target_product ->> 'status', ''), 'draft') <> 'draft'
    or char_length(target_product ->> 'product_name') > 200
    or char_length(coalesce(target_product ->> 'product_type', '')) > 100
    or (target_product ? 'product_type' and nullif(btrim(target_product ->> 'product_type'), '') is null)
    or char_length(coalesce(target_product ->> 'product_no', '')) > 100
    or (target_product ? 'product_no' and (
      nullif(target_product ->> 'product_no', '') is null
      or target_product ->> 'product_no' !~ '^[^[:space:][:cntrl:]]+$'
    ))
    or char_length(coalesce(target_product ->> 'product_model', '')) > 100
    or char_length(coalesce(target_product ->> 'material', '')) > 200
    or char_length(coalesce(target_product ->> 'color', '')) > 100
    or char_length(coalesce(target_product ->> 'remark', '')) > 2000
    or char_length(coalesce(target_product ->> 'internal_remark', '')) > 2000
    or (target_product ? 'quantity' and (
      jsonb_typeof(target_product -> 'quantity') <> 'number'
      or (target_product ->> 'quantity')::numeric <= 0
    ))
    or exists (
      select 1 from unnest(array['width','height','depth','area']) as fields(field_name)
      where target_product ? field_name and case jsonb_typeof(target_product -> field_name)
        when 'null' then false
        when 'number' then (target_product ->> field_name)::numeric < 0
        when 'string' then target_product ->> field_name !~ '^[0-9]+([.][0-9]+)?$'
          or (target_product ->> field_name)::numeric < 0
        else true
      end
    )
    or exists (
      select 1 from unnest(array['quoted_amount','cost_amount','profit_amount']) as fields(field_name)
      where target_product ? field_name and jsonb_typeof(target_product -> field_name) <> 'number'
    ) then
    raise exception using errcode = '22023', message = 'ORDER_PRODUCT_INPUT_INVALID';
  end if;
  quoted_amount := coalesce((target_product ->> 'quoted_amount')::numeric, 0);
  cost_amount := coalesce((target_product ->> 'cost_amount')::numeric, 0);
  profit_amount := coalesce((target_product ->> 'profit_amount')::numeric, 0);
  if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')
    and not app_private.has_enterprise_permission(target_enterprise_id, 'orders.create') then
    raise exception using errcode = '42501', message = 'ORDER_PRODUCT_CREATE_FORBIDDEN';
  end if;
  select * into order_row from public.orders
  where enterprise_id = target_enterprise_id and id = target_order_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  if order_row.status not in ('draft', 'pending', 'returned', 'rejected') then
    raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT';
  end if;
  if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')
    and not (app_private.has_enterprise_permission(target_enterprise_id, 'orders.create') and order_row.created_by = actor_id) then
    raise exception using errcode = '42501', message = 'ORDER_PRODUCT_CREATE_FORBIDDEN';
  end if;
  if target_product ?| array['cost_amount', 'profit_amount', 'internal_remark']
    and not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception using errcode = '42501', message = 'ORDER_PRODUCT_FINANCE_FORBIDDEN';
  end if;
  if quoted_amount < 0 or quoted_amount <> trunc(quoted_amount)
    or cost_amount < 0 or cost_amount <> trunc(cost_amount)
    or profit_amount <> trunc(profit_amount) then
    raise exception using errcode = '22023', message = 'ORDER_PRODUCT_INPUT_INVALID';
  end if;
  select * into space_row from public.order_spaces
  where enterprise_id = target_enterprise_id and order_id = target_order_id
    and id = (target_product ->> 'space_id')::uuid
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_PRODUCT_SPACE_NOT_FOUND'; end if;
  if space_row.status not in ('draft', 'pending', 'returned', 'rejected') then
    raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT';
  end if;
  select coalesce(max(case
    when char_length(substring(product_no from '-P([0-9]+)$')) <= 9
      then (substring(product_no from '-P([0-9]+)$'))::integer
    else null
  end), 0) + 1
  into next_index from public.order_products
  where enterprise_id = target_enterprise_id and space_id = space_row.id;
  insert into public.order_products (
    enterprise_id, order_id, space_id, product_no, product_name, product_type,
    product_model, width, height, depth, area, quantity, material, color, status,
    quoted_amount, cost_amount, profit_amount, sort_order, remark, internal_remark, updated_at
  ) values (
    target_enterprise_id, target_order_id, space_row.id,
    coalesce(nullif(target_product ->> 'product_no', ''), space_row.space_no || '-P' || lpad(next_index::text, 2, '0')),
    btrim(target_product ->> 'product_name'), coalesce(nullif(target_product ->> 'product_type', ''), 'custom'),
    nullif(target_product ->> 'product_model', ''), (target_product ->> 'width')::numeric,
    (target_product ->> 'height')::numeric, (target_product ->> 'depth')::numeric,
    (target_product ->> 'area')::numeric, coalesce((target_product ->> 'quantity')::numeric, 1),
    nullif(target_product ->> 'material', ''), nullif(target_product ->> 'color', ''), 'draft',
    quoted_amount, cost_amount, profit_amount, coalesce((target_product ->> 'sort_order')::integer, next_index),
    nullif(target_product ->> 'remark', ''), nullif(target_product ->> 'internal_remark', ''), now()
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
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if jsonb_typeof(target_product) <> 'object'
    or coalesce(nullif(target_product ->> 'status', ''), 'draft') <> 'draft' then
    raise exception using errcode = '22023', message = 'ORDER_PRODUCT_INPUT_INVALID';
  end if;
  if target_product ?| array['quoted_amount', 'cost_amount', 'profit_amount', 'internal_remark']
    and not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception using errcode = '42501', message = 'ORDER_PRODUCT_FINANCE_FORBIDDEN';
  end if;
  return query
  select * from app_private.create_order_product_with_pricing_internal(
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
  module_order_id uuid;
  created_item public.order_items%rowtype;
  unit_price numeric := 0;
  subtotal numeric := 0;
begin
  if actor_id is null or jsonb_typeof(target_item) <> 'object'
    or target_item - array[
      'module_id', 'item_no', 'product_name', 'specifications', 'woodworking_craft',
      'forming_craft', 'painting_craft', 'length_mm', 'width_mm', 'thickness_mm',
      'quantity', 'unit', 'color', 'hardware', 'hardware_quantity',
      'construction_surface', 'unit_price', 'subtotal', 'remark', 'sort_order'
    ] <> '{}'::jsonb or nullif(btrim(target_item ->> 'product_name'), '') is null
    or char_length(target_item ->> 'product_name') > 200
    or char_length(coalesce(target_item ->> 'item_no', '')) > 100
    or char_length(coalesce(target_item ->> 'specifications', '')) > 1000
    or char_length(coalesce(target_item ->> 'woodworking_craft', '')) > 500
    or char_length(coalesce(target_item ->> 'forming_craft', '')) > 500
    or char_length(coalesce(target_item ->> 'painting_craft', '')) > 500
    or char_length(coalesce(target_item ->> 'unit', '')) > 30
    or char_length(coalesce(target_item ->> 'color', '')) > 100
    or char_length(coalesce(target_item ->> 'hardware', '')) > 1000
    or char_length(coalesce(target_item ->> 'construction_surface', '')) > 500
    or char_length(coalesce(target_item ->> 'remark', '')) > 2000
    or (target_item ? 'quantity' and (
      jsonb_typeof(target_item -> 'quantity') <> 'number'
      or (target_item ->> 'quantity')::numeric <= 0
    ))
    or exists (
      select 1 from unnest(array['length_mm','width_mm','thickness_mm','hardware_quantity']) as fields(field_name)
      where target_item ? field_name and case jsonb_typeof(target_item -> field_name)
        when 'null' then false
        when 'number' then (target_item ->> field_name)::numeric < 0
        when 'string' then target_item ->> field_name !~ '^[0-9]+([.][0-9]+)?$'
          or (target_item ->> field_name)::numeric < 0
        else true
      end
    )
    or exists (
      select 1 from unnest(array['unit_price','subtotal']) as fields(field_name)
      where target_item ? field_name and jsonb_typeof(target_item -> field_name) <> 'number'
    ) then
    raise exception using errcode = '22023', message = 'ORDER_ITEM_INPUT_INVALID';
  end if;
  unit_price := coalesce((target_item ->> 'unit_price')::numeric, 0);
  subtotal := coalesce((target_item ->> 'subtotal')::numeric, 0);
  if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')
    and not app_private.has_enterprise_permission(target_enterprise_id, 'orders.create') then
    raise exception using errcode = '42501', message = 'ORDER_ITEM_CREATE_FORBIDDEN';
  end if;
  select * into order_row from public.orders
  where enterprise_id = target_enterprise_id and id = target_order_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  if order_row.status not in ('draft', 'pending', 'returned', 'rejected') then
    raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT';
  end if;
  if not (
    app_private.has_enterprise_permission(target_enterprise_id, 'orders.create')
      and order_row.created_by = actor_id
      and order_row.status in ('draft', 'pending')
  ) and not (
    app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')
      and app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage')
  ) then
    raise exception using errcode = '42501', message = 'ORDER_ITEM_CREATE_FORBIDDEN';
  end if;
  if unit_price < 0 or unit_price <> trunc(unit_price) or subtotal < 0 or subtotal <> trunc(subtotal) then
    raise exception using errcode = '22023', message = 'ORDER_ITEM_INPUT_INVALID';
  end if;
  if nullif(target_item ->> 'module_id', '') is not null then
    select module_row.order_id into module_order_id from public.order_modules module_row
    where module_row.enterprise_id = target_enterprise_id and module_row.order_id = target_order_id
      and module_row.id = (target_item ->> 'module_id')::uuid
    for update;
    if not found then raise exception using errcode = 'P0002', message = 'ORDER_ITEM_MODULE_NOT_FOUND'; end if;
  end if;
  insert into public.order_items (
    enterprise_id, order_id, module_id, item_no, product_name, specifications,
    woodworking_craft, forming_craft, painting_craft, length_mm, width_mm, thickness_mm,
    quantity, unit, color, hardware, hardware_quantity, construction_surface,
    unit_price, subtotal, remark, sort_order, updated_at
  ) values (
    target_enterprise_id, target_order_id, nullif(target_item ->> 'module_id', '')::uuid,
    nullif(target_item ->> 'item_no', ''), btrim(target_item ->> 'product_name'),
    nullif(target_item ->> 'specifications', ''), nullif(target_item ->> 'woodworking_craft', ''),
    nullif(target_item ->> 'forming_craft', ''), nullif(target_item ->> 'painting_craft', ''),
    (target_item ->> 'length_mm')::numeric, (target_item ->> 'width_mm')::numeric,
    (target_item ->> 'thickness_mm')::numeric, coalesce((target_item ->> 'quantity')::numeric, 1),
    coalesce(nullif(target_item ->> 'unit', ''), '件'), nullif(target_item ->> 'color', ''),
    nullif(target_item ->> 'hardware', ''), (target_item ->> 'hardware_quantity')::numeric,
    nullif(target_item ->> 'construction_surface', ''), unit_price, subtotal,
    nullif(target_item ->> 'remark', ''), coalesce((target_item ->> 'sort_order')::integer, 1), now()
  ) returning * into created_item;
  return next created_item;
end;
$$;

create function public.update_order_component_fields(
  target_enterprise_id uuid,
  target_type text,
  target_id uuid,
  target_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  component_order_id uuid;
  component_status text;
  order_status text;
begin
  if auth.uid() is null or target_type is null or target_type not in ('space', 'product')
    or jsonb_typeof(target_fields) <> 'object' or target_fields = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'ORDER_COMPONENT_FIELDS_INVALID';
  end if;
  if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.update') then
    raise exception using errcode = '42501', message = 'ORDER_COMPONENT_WRITE_FORBIDDEN';
  end if;
  if target_type = 'space' then
    if target_fields - array['space_name', 'space_type', 'sort_order', 'remark'] <> '{}'::jsonb
      or (target_fields ? 'space_name' and (
        nullif(btrim(target_fields ->> 'space_name'), '') is null
        or char_length(target_fields ->> 'space_name') > 200
      ))
      or char_length(coalesce(target_fields ->> 'space_type', '')) > 100
      or char_length(coalesce(target_fields ->> 'remark', '')) > 2000
      or (target_fields ? 'sort_order' and (
        jsonb_typeof(target_fields -> 'sort_order') <> 'number'
        or (target_fields ->> 'sort_order')::numeric <> trunc((target_fields ->> 'sort_order')::numeric)
        or (target_fields ->> 'sort_order')::numeric < 0
      )) then
      raise exception using errcode = '22023', message = 'ORDER_COMPONENT_FIELDS_INVALID';
    end if;
    select order_id into component_order_id from public.order_spaces
    where enterprise_id = target_enterprise_id and id = target_id;
  else
    if target_fields - array[
      'product_name', 'product_type', 'product_model', 'width', 'height', 'depth',
      'area', 'quantity', 'material', 'color', 'sort_order', 'remark'
    ] <> '{}'::jsonb
      or (target_fields ? 'product_name' and (
        nullif(btrim(target_fields ->> 'product_name'), '') is null
        or char_length(target_fields ->> 'product_name') > 200
      ))
      or (target_fields ? 'product_type' and (
        nullif(btrim(target_fields ->> 'product_type'), '') is null
        or char_length(target_fields ->> 'product_type') > 100
      ))
      or char_length(coalesce(target_fields ->> 'product_model', '')) > 100
      or char_length(coalesce(target_fields ->> 'material', '')) > 200
      or char_length(coalesce(target_fields ->> 'color', '')) > 100
      or char_length(coalesce(target_fields ->> 'remark', '')) > 2000
      or (target_fields ? 'quantity' and (
        jsonb_typeof(target_fields -> 'quantity') <> 'number'
        or (target_fields ->> 'quantity')::numeric <= 0
      ))
      or exists (
        select 1 from unnest(array['width','height','depth','area']) as fields(field_name)
        where target_fields ? field_name
          and jsonb_typeof(target_fields -> field_name) not in ('number', 'null')
      )
      or exists (
        select 1 from unnest(array['width','height','depth','area']) as fields(field_name)
        where target_fields ? field_name
          and jsonb_typeof(target_fields -> field_name) = 'number'
          and (target_fields ->> field_name)::numeric < 0
      )
      or (target_fields ? 'sort_order' and (
        jsonb_typeof(target_fields -> 'sort_order') <> 'number'
        or (target_fields ->> 'sort_order')::numeric <> trunc((target_fields ->> 'sort_order')::numeric)
        or (target_fields ->> 'sort_order')::numeric < 0
      )) then
      raise exception using errcode = '22023', message = 'ORDER_COMPONENT_FIELDS_INVALID';
    end if;
    select order_id into component_order_id from public.order_products
    where enterprise_id = target_enterprise_id and id = target_id;
  end if;
  if component_order_id is null then raise exception using errcode = 'P0002', message = 'ORDER_COMPONENT_NOT_FOUND'; end if;
  select status into order_status from public.orders
  where enterprise_id = target_enterprise_id and id = component_order_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  if order_status not in ('draft', 'pending', 'returned', 'rejected') then
    raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT';
  end if;
  if target_type = 'space' then
    select status into component_status from public.order_spaces
    where enterprise_id = target_enterprise_id and id = target_id
      and order_id = component_order_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'ORDER_COMPONENT_NOT_FOUND'; end if;
    if component_status not in ('draft', 'pending', 'returned', 'rejected') then
      raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT';
    end if;
    update public.order_spaces set
      space_name = case when target_fields ? 'space_name' then btrim(target_fields ->> 'space_name') else space_name end,
      space_type = case when target_fields ? 'space_type' then nullif(btrim(target_fields ->> 'space_type'), '') else space_type end,
      sort_order = case when target_fields ? 'sort_order' then (target_fields ->> 'sort_order')::integer else sort_order end,
      remark = case when target_fields ? 'remark' then nullif(btrim(target_fields ->> 'remark'), '') else remark end,
      updated_at = now()
    where enterprise_id = target_enterprise_id and id = target_id;
  else
    select status into component_status from public.order_products
    where enterprise_id = target_enterprise_id and id = target_id
      and order_id = component_order_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'ORDER_COMPONENT_NOT_FOUND'; end if;
    if component_status not in ('draft', 'pending', 'returned', 'rejected') then
      raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT';
    end if;
    update public.order_products set
      product_name = case when target_fields ? 'product_name' then btrim(target_fields ->> 'product_name') else product_name end,
      product_type = case when target_fields ? 'product_type' then btrim(target_fields ->> 'product_type') else product_type end,
      product_model = case when target_fields ? 'product_model' then nullif(btrim(target_fields ->> 'product_model'), '') else product_model end,
      width = case when target_fields ? 'width' then (target_fields ->> 'width')::numeric else width end,
      height = case when target_fields ? 'height' then (target_fields ->> 'height')::numeric else height end,
      depth = case when target_fields ? 'depth' then (target_fields ->> 'depth')::numeric else depth end,
      area = case when target_fields ? 'area' then (target_fields ->> 'area')::numeric else area end,
      quantity = case when target_fields ? 'quantity' then (target_fields ->> 'quantity')::numeric else quantity end,
      material = case when target_fields ? 'material' then nullif(btrim(target_fields ->> 'material'), '') else material end,
      color = case when target_fields ? 'color' then nullif(btrim(target_fields ->> 'color'), '') else color end,
      sort_order = case when target_fields ? 'sort_order' then (target_fields ->> 'sort_order')::integer else sort_order end,
      remark = case when target_fields ? 'remark' then nullif(btrim(target_fields ->> 'remark'), '') else remark end,
      updated_at = now()
    where enterprise_id = target_enterprise_id and id = target_id;
  end if;
  return jsonb_build_object('id', target_id);
end;
$$;

alter function public.create_order_space(uuid, uuid, jsonb) owner to v2_function_owner;
alter function public.create_order_product_with_pricing(uuid, uuid, jsonb) owner to v2_function_owner;
alter function app_private.create_order_product_with_pricing_internal(uuid, uuid, jsonb) owner to v2_function_owner;
alter function public.create_order_item_with_pricing(uuid, uuid, jsonb) owner to v2_function_owner;
alter function public.update_order_component_fields(uuid, text, uuid, jsonb) owner to v2_function_owner;
revoke all on function public.create_order_space(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.create_order_product_with_pricing(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function app_private.create_order_product_with_pricing_internal(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.create_order_item_with_pricing(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.update_order_component_fields(uuid, text, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_order_space(uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_order_product_with_pricing(uuid, uuid, jsonb) to authenticated;
grant execute on function public.create_order_item_with_pricing(uuid, uuid, jsonb) to authenticated;
grant execute on function public.update_order_component_fields(uuid, text, uuid, jsonb) to authenticated;
revoke create on schema public from v2_function_owner;
do $$
begin
  if exists (select 1 from pg_catalog.pg_auth_members where roleid = 'v2_function_owner'::regrole and member = 'postgres'::regrole) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
