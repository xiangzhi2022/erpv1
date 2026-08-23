-- Save an order and every generated tree layer in one guarded transaction.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select on table
  public.enterprises,
  public.orders,
  public.order_modules,
  public.order_items,
  public.order_spaces,
  public.order_products,
  public.production_tasks,
  public.order_item_attachments
to v2_function_owner;
grant insert, update on table public.orders to v2_function_owner;
grant insert on table
  public.order_modules,
  public.order_spaces,
  public.order_item_attachments,
  public.order_status_logs
to v2_function_owner;

create function public.save_order_tree(
  target_enterprise_id uuid,
  target_existing_order_id uuid,
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
  recipient_enterprise_id uuid;
  recipient_type text;
  target_flow text;
  expected_flow text;
  expected_recipient_type text;
  can_read_finance boolean := false;
  resolved_factory_id uuid;
  supplied_factory_id uuid;
  parent_id uuid;
  order_row public.orders%rowtype;
  previous_status text;
  module_input jsonb;
  item_input jsonb;
  task_input jsonb;
  attachment_input jsonb;
  queued_attachment jsonb;
  created_module public.order_modules%rowtype;
  created_item public.order_items%rowtype;
  created_space public.order_spaces%rowtype;
  created_product public.order_products%rowtype;
  module_index integer := 0;
  item_index integer;
  task_index integer;
  total_item_count integer := 0;
  order_number text;
  module_number text;
  item_number text;
  space_number text;
  product_number text;
  unit_price_cents numeric;
  item_quantity numeric;
  total_amount_cents numeric := 0;
  task_payloads jsonb := '[]'::jsonb;
  attachment_payloads jsonb := '[]'::jsonb;
  now_at timestamptz := now();
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if target_enterprise_id is null
    or jsonb_typeof(target_order) <> 'object'
    or target_order - array[
      'order_no', 'order_flow', 'to_tenant_id', 'target_factory_id',
      'parent_order_id', 'customer_name', 'customer_phone', 'customer_address',
      'delivery_date', 'remark', 'modules'
    ] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'ORDER_TREE_INPUT_INVALID';
  end if;

  order_number := nullif(btrim(target_order ->> 'order_no'), '');
  target_flow := target_order ->> 'order_flow';
  recipient_enterprise_id := nullif(target_order ->> 'to_tenant_id', '')::uuid;
  supplied_factory_id := nullif(target_order ->> 'target_factory_id', '')::uuid;
  parent_id := nullif(target_order ->> 'parent_order_id', '')::uuid;

  if order_number is null
    or char_length(order_number) > 100
    or nullif(btrim(target_order ->> 'customer_name'), '') is null
    or char_length(target_order ->> 'customer_name') > 200
    or char_length(coalesce(target_order ->> 'customer_phone', '')) > 100
    or char_length(coalesce(target_order ->> 'customer_address', '')) > 1000
    or char_length(coalesce(target_order ->> 'remark', '')) > 2000
    or jsonb_typeof(target_order -> 'modules') is distinct from 'array'
    or jsonb_array_length(target_order -> 'modules') < 1
    or jsonb_array_length(target_order -> 'modules') > 100 then
    raise exception using errcode = '22023', message = 'ORDER_TREE_INPUT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_enterprise_id::text, 0)
  );

  select enterprise.enterprise_type
  into source_enterprise_type
  from public.enterprises enterprise
  where enterprise.id = target_enterprise_id
    and enterprise.status = 'active';
  if source_enterprise_type is null then
    raise exception using errcode = '42501', message = 'ORDER_TREE_CREATE_FORBIDDEN';
  end if;
  can_read_finance := app_private.has_enterprise_permission(
    target_enterprise_id,
    'finance.read'
  );

  expected_flow := case source_enterprise_type
    when 'dealer' then 'dealer_to_factory'
    when 'manufacturer' then 'factory_to_supplier'
    else null
  end;
  expected_recipient_type := case expected_flow
    when 'dealer_to_factory' then 'manufacturer'
    when 'factory_to_supplier' then 'supplier'
    else null
  end;
  if expected_flow is null or target_flow is distinct from expected_flow then
    raise exception using errcode = '42501', message = 'ORDER_TREE_FLOW_FORBIDDEN';
  end if;

  select enterprise.enterprise_type
  into recipient_type
  from public.enterprises enterprise
  where enterprise.id = recipient_enterprise_id
    and enterprise.status = 'active';
  if recipient_type is distinct from expected_recipient_type then
    raise exception using errcode = '22023', message = 'ORDER_RECIPIENT_INVALID';
  end if;

  resolved_factory_id := case
    when target_flow = 'dealer_to_factory' then recipient_enterprise_id
    else target_enterprise_id
  end;
  if supplied_factory_id is not null and supplied_factory_id <> resolved_factory_id then
    raise exception using errcode = '22023', message = 'ORDER_FACTORY_INVALID';
  end if;

  if parent_id is not null and not exists (
    select 1
    from public.orders parent_order
    where parent_order.enterprise_id = target_enterprise_id
      and parent_order.id = parent_id
      and (
        target_flow <> 'factory_to_supplier'
        or (
          parent_order.order_flow = 'dealer_to_factory'
          and parent_order.to_enterprise_id = target_enterprise_id
        )
      )
  ) then
    raise exception using errcode = 'P0002', message = 'PARENT_ORDER_NOT_FOUND';
  end if;

  if target_existing_order_id is null then
    if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.create')
      or not app_private.has_enterprise_permission(target_enterprise_id, 'orders.update') then
      raise exception using errcode = '42501', message = 'ORDER_TREE_CREATE_FORBIDDEN';
    end if;
  else
    if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')
      or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
      raise exception using errcode = '42501', message = 'ORDER_TREE_UPDATE_FORBIDDEN';
    end if;
    select *
    into order_row
    from public.orders existing_order
    where existing_order.enterprise_id = target_enterprise_id
      and existing_order.id = target_existing_order_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
    end if;
    if order_row.status not in ('draft', 'pending', 'returned', 'rejected') then
      raise exception using errcode = 'P0001', message = 'ORDER_TREE_STATUS_CONFLICT';
    end if;
    if exists (
      select 1 from public.order_modules child where child.enterprise_id = target_enterprise_id and child.order_id = target_existing_order_id
      union all
      select 1 from public.order_items child where child.enterprise_id = target_enterprise_id and child.order_id = target_existing_order_id
      union all
      select 1 from public.order_spaces child where child.enterprise_id = target_enterprise_id and child.order_id = target_existing_order_id
      union all
      select 1 from public.order_products child where child.enterprise_id = target_enterprise_id and child.order_id = target_existing_order_id
      union all
      select 1 from public.production_tasks child where child.enterprise_id = target_enterprise_id and child.order_id = target_existing_order_id
      union all
      select 1 from public.order_item_attachments child where child.enterprise_id = target_enterprise_id and child.order_id = target_existing_order_id
    ) then
      raise exception using errcode = 'P0001', message = 'ORDER_TREE_NOT_EMPTY';
    end if;
  end if;

  if exists (
    select 1
    from public.orders duplicate_order
    where duplicate_order.enterprise_id = target_enterprise_id
      and duplicate_order.order_no = order_number
      and (target_existing_order_id is null or duplicate_order.id <> target_existing_order_id)
  ) then
    raise exception using errcode = '23505', message = 'ORDER_NUMBER_CONFLICT';
  end if;

  for module_input in select value from jsonb_array_elements(target_order -> 'modules')
  loop
    if jsonb_typeof(module_input) <> 'object'
      or module_input - array['module_name', 'remark', 'items'] <> '{}'::jsonb
      or nullif(btrim(module_input ->> 'module_name'), '') is null
      or char_length(module_input ->> 'module_name') > 200
      or char_length(coalesce(module_input ->> 'remark', '')) > 2000
      or jsonb_typeof(module_input -> 'items') is distinct from 'array'
      or jsonb_array_length(module_input -> 'items') < 1
      or jsonb_array_length(module_input -> 'items') > 500 then
      raise exception using errcode = '22023', message = 'ORDER_MODULE_INPUT_INVALID';
    end if;
    for item_input in select value from jsonb_array_elements(module_input -> 'items')
    loop
      total_item_count := total_item_count + 1;
      if total_item_count > 500 then
        raise exception using errcode = '22023', message = 'ORDER_TREE_TOO_LARGE';
      end if;
      if jsonb_typeof(item_input) <> 'object'
        or item_input - array[
          'product_name', 'product_type', 'specification', 'material',
          'woodworking_craft', 'forming_craft', 'painting_craft', 'length_mm',
          'width_mm', 'thickness_mm', 'quantity', 'unit', 'color', 'hardware',
          'hardware_quantity', 'construction_surface', 'unit_price', 'remark',
          'attachments', 'tasks'
        ] <> '{}'::jsonb
        or nullif(btrim(item_input ->> 'product_name'), '') is null
        or char_length(item_input ->> 'product_name') > 200
        or nullif(btrim(item_input ->> 'unit'), '') is null
        or coalesce((item_input ->> 'quantity')::numeric, 0) <= 0
        or (item_input ->> 'quantity')::numeric <> trunc((item_input ->> 'quantity')::numeric)
        or coalesce((item_input ->> 'unit_price')::numeric, -1) < 0
        or coalesce(jsonb_typeof(item_input -> 'tasks'), 'array') <> 'array'
        or coalesce(jsonb_typeof(item_input -> 'attachments'), 'array') <> 'array' then
        raise exception using errcode = '22023', message = 'ORDER_ITEM_INPUT_INVALID';
      end if;
      total_amount_cents := total_amount_cents
        + pg_catalog.round((item_input ->> 'unit_price')::numeric * 100)
        * (item_input ->> 'quantity')::numeric;
    end loop;
  end loop;
  if total_amount_cents < 0 or total_amount_cents <> trunc(total_amount_cents) then
    raise exception using errcode = '22023', message = 'ORDER_TOTAL_INVALID';
  end if;

  if target_existing_order_id is null then
    insert into public.orders (
      enterprise_id, order_no, customer_name, customer_phone, customer_address,
      status, total_amount, target_factory_id, dealer_id, order_flow,
      from_enterprise_id, to_enterprise_id, parent_order_id, delivery_date,
      remark, created_by, updated_at
    ) values (
      target_enterprise_id,
      order_number,
      btrim(target_order ->> 'customer_name'),
      nullif(btrim(target_order ->> 'customer_phone'), ''),
      nullif(btrim(target_order ->> 'customer_address'), ''),
      'pending',
      total_amount_cents,
      resolved_factory_id,
      case when target_flow = 'dealer_to_factory' then target_enterprise_id else null end,
      target_flow,
      target_enterprise_id,
      recipient_enterprise_id,
      parent_id,
      nullif(target_order ->> 'delivery_date', '')::date,
      nullif(btrim(target_order ->> 'remark'), ''),
      actor_id,
      now_at
    ) returning * into order_row;
  else
    previous_status := order_row.status;
    update public.orders existing_order
    set order_no = order_number,
        customer_name = btrim(target_order ->> 'customer_name'),
        customer_phone = nullif(btrim(target_order ->> 'customer_phone'), ''),
        customer_address = nullif(btrim(target_order ->> 'customer_address'), ''),
        status = 'pending',
        total_amount = total_amount_cents,
        target_factory_id = resolved_factory_id,
        dealer_id = case when target_flow = 'dealer_to_factory' then target_enterprise_id else null end,
        order_flow = target_flow,
        from_enterprise_id = target_enterprise_id,
        to_enterprise_id = recipient_enterprise_id,
        parent_order_id = parent_id,
        delivery_date = nullif(target_order ->> 'delivery_date', '')::date,
        remark = nullif(btrim(target_order ->> 'remark'), ''),
        updated_at = now_at
    where existing_order.enterprise_id = target_enterprise_id
      and existing_order.id = target_existing_order_id
    returning * into order_row;
    if previous_status <> 'pending' then
      insert into public.order_status_logs (
        enterprise_id, target_type, target_id, from_status, to_status,
        changed_by, remark
      ) values (
        target_enterprise_id, 'order', order_row.id, previous_status, 'pending',
        actor_id, 'Save order tree'
      );
    end if;
  end if;

  module_index := 0;
  for module_input in select value from jsonb_array_elements(target_order -> 'modules')
  loop
    module_index := module_index + 1;
    item_index := 0;
    module_number := order_number || '-M' || lpad(module_index::text, 2, '0');
    space_number := order_number || '-S' || lpad(module_index::text, 2, '0');

    insert into public.order_modules (
      enterprise_id, order_id, module_no, module_name, sort_order, remark, updated_at
    ) values (
      target_enterprise_id, order_row.id, module_number,
      btrim(module_input ->> 'module_name'), module_index,
      nullif(btrim(module_input ->> 'remark'), ''), now_at
    ) returning * into created_module;

    insert into public.order_spaces (
      enterprise_id, order_id, space_no, space_name, space_type,
      sort_order, remark, updated_at
    ) values (
      target_enterprise_id, order_row.id, space_number,
      btrim(module_input ->> 'module_name'), 'custom', module_index,
      nullif(btrim(module_input ->> 'remark'), ''), now_at
    ) returning * into created_space;

    for item_input in select value from jsonb_array_elements(module_input -> 'items')
    loop
      item_index := item_index + 1;
      task_index := 0;
      item_number := module_number || '-I' || lpad(item_index::text, 2, '0');
      product_number := space_number || '-P' || lpad(item_index::text, 2, '0');
      item_quantity := (item_input ->> 'quantity')::numeric;
      unit_price_cents := pg_catalog.round((item_input ->> 'unit_price')::numeric * 100);

      select * into created_item
      from public.create_order_item_with_pricing(
        target_enterprise_id,
        order_row.id,
        jsonb_build_object(
          'module_id', created_module.id,
          'item_no', item_number,
          'product_name', btrim(item_input ->> 'product_name'),
          'specifications', nullif(btrim(item_input ->> 'specification'), ''),
          'woodworking_craft', nullif(btrim(item_input ->> 'woodworking_craft'), ''),
          'forming_craft', nullif(btrim(item_input ->> 'forming_craft'), ''),
          'painting_craft', nullif(btrim(item_input ->> 'painting_craft'), ''),
          'length_mm', nullif(item_input ->> 'length_mm', ''),
          'width_mm', nullif(item_input ->> 'width_mm', ''),
          'thickness_mm', nullif(item_input ->> 'thickness_mm', ''),
          'quantity', item_quantity,
          'unit', btrim(item_input ->> 'unit'),
          'color', nullif(btrim(item_input ->> 'color'), ''),
          'hardware', nullif(btrim(item_input ->> 'hardware'), ''),
          'hardware_quantity', nullif(item_input ->> 'hardware_quantity', ''),
          'construction_surface', nullif(btrim(item_input ->> 'construction_surface'), ''),
          'unit_price', unit_price_cents,
          'subtotal', unit_price_cents * item_quantity,
          'remark', nullif(btrim(item_input ->> 'remark'), ''),
          'sort_order', item_index
        )
      );

      select * into created_product
      from app_private.create_order_product_with_pricing_internal(
        target_enterprise_id,
        order_row.id,
        jsonb_build_object(
          'space_id', created_space.id,
          'product_no', product_number,
          'product_name', btrim(item_input ->> 'product_name'),
          'product_type', coalesce(nullif(item_input ->> 'product_type', ''), case when nullif(item_input ->> 'hardware', '') is null then 'custom' else 'hardware' end),
          'width', nullif(item_input ->> 'width_mm', ''),
          'height', nullif(item_input ->> 'length_mm', ''),
          'depth', nullif(item_input ->> 'thickness_mm', ''),
          'quantity', item_quantity,
          'material', coalesce(nullif(btrim(item_input ->> 'material'), ''), nullif(btrim(item_input ->> 'specification'), '')),
          'color', nullif(btrim(item_input ->> 'color'), ''),
          'status', 'draft',
          'quoted_amount', unit_price_cents * item_quantity,
          'sort_order', item_index,
          'remark', nullif(btrim(item_input ->> 'remark'), '')
        )
      );

      for task_input in select value from jsonb_array_elements(coalesce(item_input -> 'tasks', '[]'::jsonb))
      loop
        task_index := task_index + 1;
        if jsonb_typeof(task_input) <> 'object'
          or task_input - array[
            'task_type', 'task_name', 'task_code', 'quantity', 'unit',
            'length_mm', 'width_mm', 'thickness_mm', 'area', 'material',
            'handleless', 'craft', 'color', 'process_name',
            'construction_surface', 'unit_price', 'subtotal', 'hardware',
            'hardware_quantity', 'remark', 'attachments'
          ] <> '{}'::jsonb
          or coalesce(jsonb_typeof(task_input -> 'attachments'), 'array') <> 'array' then
          raise exception using errcode = '22023', message = 'PRODUCTION_TASK_INPUT_INVALID';
        end if;
        task_payloads := task_payloads || jsonb_build_array(jsonb_build_object(
          'space_id', created_space.id,
          'product_id', created_product.id,
          'task_no', product_number || '-T' || lpad(task_index::text, 2, '0'),
          'task_type', task_input ->> 'task_type',
          'task_name', btrim(task_input ->> 'task_name'),
          'task_code', nullif(btrim(task_input ->> 'task_code'), ''),
          'product_name', btrim(item_input ->> 'product_name'),
          'quantity', (task_input ->> 'quantity')::numeric,
          'unit', coalesce(nullif(task_input ->> 'unit', ''), item_input ->> 'unit'),
          'length', coalesce(nullif(task_input ->> 'length_mm', ''), nullif(item_input ->> 'length_mm', '')),
          'width', coalesce(nullif(task_input ->> 'width_mm', ''), nullif(item_input ->> 'width_mm', '')),
          'thickness', coalesce(nullif(task_input ->> 'thickness_mm', ''), nullif(item_input ->> 'thickness_mm', '')),
          'area', nullif(task_input ->> 'area', ''),
          'material', coalesce(nullif(btrim(task_input ->> 'material'), ''), nullif(btrim(item_input ->> 'material'), ''), nullif(btrim(item_input ->> 'specification'), '')),
          'color', coalesce(nullif(btrim(task_input ->> 'color'), ''), nullif(btrim(item_input ->> 'color'), '')),
          'process_name', nullif(btrim(task_input ->> 'process_name'), ''),
          'initial_status', 'pending_generate',
          'remark', nullif(btrim(task_input ->> 'remark'), '')
        ));
        for attachment_input in select value from jsonb_array_elements(coalesce(task_input -> 'attachments', '[]'::jsonb))
        loop
          attachment_payloads := attachment_payloads || jsonb_build_array(jsonb_build_object(
            'module_id', created_module.id,
            'order_item_id', created_item.id,
            'attachment', attachment_input
          ));
        end loop;
      end loop;

      for attachment_input in select value from jsonb_array_elements(coalesce(item_input -> 'attachments', '[]'::jsonb))
      loop
        attachment_payloads := attachment_payloads || jsonb_build_array(jsonb_build_object(
          'module_id', created_module.id,
          'order_item_id', created_item.id,
          'attachment', attachment_input
        ));
      end loop;
    end loop;
  end loop;

  if jsonb_array_length(task_payloads) > 500
    or jsonb_array_length(attachment_payloads) > 1000 then
    raise exception using errcode = '22023', message = 'ORDER_TREE_TOO_LARGE';
  end if;
  if jsonb_array_length(task_payloads) > 0 then
    if not app_private.has_enterprise_permission(target_enterprise_id, 'production.plan')
      or not app_private.has_enterprise_permission(target_enterprise_id, 'production.manage') then
      raise exception using errcode = '42501', message = 'ORDER_TREE_TASK_FORBIDDEN';
    end if;
    perform public.create_production_tasks(
      target_enterprise_id,
      order_row.id,
      task_payloads
    );
  end if;

  if jsonb_array_length(attachment_payloads) > 0
    and not app_private.has_enterprise_permission(target_enterprise_id, 'attachments.manage') then
    raise exception using errcode = '42501', message = 'ORDER_TREE_ATTACHMENT_FORBIDDEN';
  end if;
  for queued_attachment in select value from jsonb_array_elements(attachment_payloads)
  loop
    attachment_input := queued_attachment -> 'attachment';
    if jsonb_typeof(attachment_input) <> 'object'
      or attachment_input - array[
        'file_name', 'file_path', 'file_url', 'file_type', 'file_size'
      ] <> '{}'::jsonb
      or nullif(btrim(attachment_input ->> 'file_name'), '') is null
      or nullif(btrim(attachment_input ->> 'file_path'), '') is null
      or nullif(btrim(attachment_input ->> 'file_url'), '') is null
      or coalesce((attachment_input ->> 'file_size')::bigint, 0) < 0
      or char_length(attachment_input ->> 'file_name') > 500
      or char_length(attachment_input ->> 'file_path') > 2000
      or char_length(attachment_input ->> 'file_url') > 4000 then
      raise exception using errcode = '22023', message = 'ORDER_ATTACHMENT_INPUT_INVALID';
    end if;
    insert into public.order_item_attachments (
      enterprise_id, order_id, module_id, order_item_id, file_name, file_path,
      file_url, file_type, file_size, uploaded_by, updated_at
    ) values (
      target_enterprise_id,
      order_row.id,
      (queued_attachment ->> 'module_id')::uuid,
      (queued_attachment ->> 'order_item_id')::uuid,
      btrim(attachment_input ->> 'file_name'),
      btrim(attachment_input ->> 'file_path'),
      btrim(attachment_input ->> 'file_url'),
      nullif(btrim(attachment_input ->> 'file_type'), ''),
      (attachment_input ->> 'file_size')::bigint,
      actor_id,
      now_at
    );
  end loop;

  return (
    select
      (to_jsonb(saved_order) - array[
        'cost_amount', 'profit_amount', 'deposit_amount', 'internal_remark', 'order_source'
      ]) || jsonb_build_object(
        'tenant_id', saved_order.enterprise_id,
        'from_tenant_id', saved_order.from_enterprise_id,
        'to_tenant_id', saved_order.to_enterprise_id,
        'items', coalesce((
          select jsonb_agg(
            (case
              when can_read_finance then to_jsonb(saved_item) - 'enterprise_id'
              else to_jsonb(saved_item) - array['enterprise_id', 'unit_price', 'subtotal']
            end)
            || jsonb_build_object(
              'attachments', coalesce((
                select jsonb_agg(to_jsonb(saved_attachment) - array['enterprise_id', 'uploaded_by'] order by saved_attachment.created_at, saved_attachment.id)
                from public.order_item_attachments saved_attachment
                where saved_attachment.enterprise_id = target_enterprise_id
                  and saved_attachment.order_id = saved_order.id
                  and saved_attachment.order_item_id = saved_item.id
              ), '[]'::jsonb)
            )
            order by saved_item.sort_order, saved_item.id
          )
          from public.order_items saved_item
          where saved_item.enterprise_id = target_enterprise_id
            and saved_item.order_id = saved_order.id
        ), '[]'::jsonb),
        'modules', coalesce((
          select jsonb_agg(
            (to_jsonb(saved_module) - 'enterprise_id')
            || jsonb_build_object(
              'items', coalesce((
                select jsonb_agg(
                  (case
                    when can_read_finance then to_jsonb(module_item) - 'enterprise_id'
                    else to_jsonb(module_item) - array['enterprise_id', 'unit_price', 'subtotal']
                  end)
                  || jsonb_build_object(
                    'attachments', coalesce((
                      select jsonb_agg(to_jsonb(item_attachment) - array['enterprise_id', 'uploaded_by'] order by item_attachment.created_at, item_attachment.id)
                      from public.order_item_attachments item_attachment
                      where item_attachment.enterprise_id = target_enterprise_id
                        and item_attachment.order_id = saved_order.id
                        and item_attachment.order_item_id = module_item.id
                    ), '[]'::jsonb)
                  )
                  order by module_item.sort_order, module_item.id
                )
                from public.order_items module_item
                where module_item.enterprise_id = target_enterprise_id
                  and module_item.order_id = saved_order.id
                  and module_item.module_id = saved_module.id
              ), '[]'::jsonb),
              'attachments', coalesce((
                select jsonb_agg(to_jsonb(module_attachment) - array['enterprise_id', 'uploaded_by'] order by module_attachment.created_at, module_attachment.id)
                from public.order_item_attachments module_attachment
                where module_attachment.enterprise_id = target_enterprise_id
                  and module_attachment.order_id = saved_order.id
                  and module_attachment.module_id = saved_module.id
              ), '[]'::jsonb)
            )
            order by saved_module.sort_order, saved_module.id
          )
          from public.order_modules saved_module
          where saved_module.enterprise_id = target_enterprise_id
            and saved_module.order_id = saved_order.id
        ), '[]'::jsonb),
        'from_tenant', (
          select jsonb_build_object('id', enterprise.id, 'name', enterprise.name, 'code', enterprise.code, 'enterprise_type', enterprise.enterprise_type)
          from public.enterprises enterprise
          where enterprise.id = saved_order.from_enterprise_id
        ),
        'to_tenant', (
          select jsonb_build_object('id', enterprise.id, 'name', enterprise.name, 'code', enterprise.code, 'enterprise_type', enterprise.enterprise_type)
          from public.enterprises enterprise
          where enterprise.id = saved_order.to_enterprise_id
        ),
        'parent_order', (
          select jsonb_build_object('id', parent.id, 'order_no', parent.order_no, 'customer_name', parent.customer_name)
          from public.orders parent
          where parent.enterprise_id = target_enterprise_id
            and parent.id = saved_order.parent_order_id
        )
      )
    from public.orders saved_order
    where saved_order.enterprise_id = target_enterprise_id
      and saved_order.id = order_row.id
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'ORDER_NUMBER_CONFLICT';
  when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
    raise exception using errcode = '22023', message = 'ORDER_TREE_INPUT_INVALID';
end;
$$;

alter function public.save_order_tree(uuid, uuid, jsonb)
  owner to v2_function_owner;
revoke all on function public.save_order_tree(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_order_tree(uuid, uuid, jsonb)
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
