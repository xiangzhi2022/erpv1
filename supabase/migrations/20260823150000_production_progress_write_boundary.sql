-- Make production progress and order-component status history RPC-only.

alter table public.order_spaces
  drop constraint if exists order_spaces_status_check;
alter table public.order_spaces
  add constraint order_spaces_status_check
  check (status in (
    'draft', 'pending', 'submitted', 'reviewed', 'confirmed', 'pool', 'accepted',
    'producing', 'partially_completed', 'ready_to_ship', 'shipped', 'completed',
    'cancelled', 'returned', 'rejected', 'withdrawn', 'abnormal'
  )) not valid;
alter table public.order_spaces validate constraint order_spaces_status_check;

alter table public.order_products
  drop constraint if exists order_products_status_check;
alter table public.order_products
  add constraint order_products_status_check
  check (status in (
    'draft', 'pending', 'submitted', 'reviewed', 'confirmed', 'pool', 'accepted',
    'producing', 'partially_completed', 'ready_to_ship', 'shipped', 'completed',
    'cancelled', 'returned', 'rejected', 'withdrawn', 'abnormal'
  )) not valid;
alter table public.order_products validate constraint order_products_status_check;

alter table public.production_tasks
  drop constraint if exists production_tasks_status_check;
alter table public.production_tasks
  add constraint production_tasks_status_check
  check (status in (
    'pending', 'pending_generate', 'pending_assign', 'assigned', 'pending_start',
    'processing', 'producing', 'submitted', 'pending_quality_check', 'quality_passed',
    'quality_failed', 'reworking', 'completed', 'cancelled', 'abnormal'
  )) not valid;
alter table public.production_tasks validate constraint production_tasks_status_check;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select on table
  public.enterprise_memberships,
  public.workers,
  public.production_tasks,
  public.work_orders,
  public.order_spaces,
  public.order_products,
  public.orders,
  public.workstations,
  public.wage_rules
to v2_function_owner;
grant insert, update on table public.production_tasks to v2_function_owner;
grant update on table public.work_orders, public.order_spaces, public.order_products, public.orders
to v2_function_owner;
grant insert on table public.progress_logs, public.order_status_logs
to v2_function_owner;

create or replace function public.report_work_order_progress(
  target_enterprise_id uuid,
  target_work_order_id uuid,
  target_action text,
  target_completed_delta numeric,
  target_remark text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  work_order_row public.work_orders%rowtype;
  log_row public.progress_logs%rowtype;
  operator_display_name text;
  required_permission text;
  requires_own_assignment boolean := false;
  next_status text;
  next_completed_quantity numeric;
  now_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if target_completed_delta is null or target_completed_delta < 0 then
    raise exception using errcode = '22023', message = 'INVALID_COMPLETED_DELTA';
  end if;

  case target_action
    when 'quality_check' then required_permission := 'production.review';
    when 'warehouse_in' then required_permission := 'shipping.manage';
    when 'pause', 'resume', 'abort' then required_permission := 'production.manage';
    when 'start', 'complete_cutting', 'complete_assembly', 'complete_painting',
         'report_progress', 'report_defect' then
      required_permission := 'production.report.self';
      requires_own_assignment := true;
    else
      raise exception using errcode = '22023', message = 'INVALID_WORK_ORDER_ACTION';
  end case;

  if not requires_own_assignment and target_completed_delta <> 0 then
    raise exception using errcode = '22023', message = 'CONTROL_ACTION_DELTA_MUST_BE_ZERO';
  end if;

  if not app_private.has_permission(target_enterprise_id, required_permission) then
    raise exception using
      errcode = '42501',
      message = case required_permission
        when 'production.review' then 'PRODUCTION_REVIEW_FORBIDDEN'
        when 'shipping.manage' then 'SHIPPING_MANAGE_FORBIDDEN'
        when 'production.manage' then 'PRODUCTION_MANAGE_FORBIDDEN'
        else 'PRODUCTION_REPORT_FORBIDDEN'
      end;
  end if;

  select membership.display_name into operator_display_name
  from public.enterprise_memberships membership
  where membership.tenant_id = target_enterprise_id
    and membership.user_id = auth.uid()
    and membership.status = 'active';
  if operator_display_name is null then
    raise exception using errcode = '42501', message = 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;

  select * into work_order_row
  from public.work_orders work_order
  where work_order.enterprise_id = target_enterprise_id
    and work_order.id = target_work_order_id
  for update;
  if work_order_row.id is null then
    raise exception using errcode = 'P0002', message = 'WORK_ORDER_NOT_FOUND';
  end if;

  if work_order_row.workshop_id is not null
    and not app_private.can_access_workshop(
      target_enterprise_id,
      required_permission,
      work_order_row.workshop_id
    ) then
    raise exception using errcode = '42501', message = 'WORKSHOP_ACCESS_FORBIDDEN';
  end if;
  if work_order_row.workshop_id is null
    and not app_private.has_enterprise_permission(target_enterprise_id, required_permission) then
    raise exception using errcode = '42501', message = 'WORKSHOP_ACCESS_FORBIDDEN';
  end if;

  if requires_own_assignment and not exists (
    select 1
    from public.workers worker
    join public.production_tasks task
      on task.enterprise_id = worker.enterprise_id
     and task.work_order_id = work_order_row.id
     and (task.worker_id = worker.id or task.assigned_worker_id = worker.id)
    where worker.enterprise_id = target_enterprise_id
      and worker.user_id = auth.uid()
      and worker.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'WORK_ORDER_NOT_ASSIGNED_TO_REPORTER';
  end if;

  if work_order_row.status in ('stored', 'aborted') then
    raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
  end if;
  next_completed_quantity := work_order_row.completed_quantity + target_completed_delta;
  if next_completed_quantity > work_order_row.target_quantity then
    raise exception using errcode = '22023', message = 'COMPLETED_QUANTITY_EXCEEDED';
  end if;

  case target_action
    when 'start' then
      if work_order_row.status not in ('pending', 'scheduling') then
        raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
      end if;
      next_status := 'producing';
    when 'complete_cutting', 'complete_assembly', 'complete_painting' then
      if work_order_row.status <> 'producing' then
        raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
      end if;
      next_status := 'producing';
    when 'quality_check' then
      if work_order_row.status <> 'producing' then
        raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
      end if;
      next_status := 'inspecting';
    when 'warehouse_in' then
      if work_order_row.status <> 'inspecting' then
        raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
      end if;
      next_status := 'stored';
    when 'report_progress', 'report_defect' then
      if work_order_row.status not in ('producing', 'inspecting') then
        raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
      end if;
      next_status := work_order_row.status;
    when 'pause' then
      if work_order_row.status <> 'producing' then
        raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
      end if;
      next_status := 'pending';
    when 'resume' then
      if work_order_row.status <> 'pending' then
        raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
      end if;
      next_status := 'producing';
    when 'abort' then
      next_status := 'aborted';
  end case;

  if next_completed_quantity >= work_order_row.target_quantity
    and target_action not in ('abort', 'warehouse_in') then
    next_status := 'inspecting';
  end if;

  update public.work_orders
  set status = next_status,
      completed_quantity = next_completed_quantity,
      updated_at = now_at,
      start_date = case
        when next_status = 'producing' and work_order_row.status <> 'producing' then now_at
        else start_date
      end,
      actual_end_date = case when next_status = 'stored' then now_at else actual_end_date end
  where enterprise_id = target_enterprise_id
    and id = work_order_row.id
    and status = work_order_row.status
  returning * into work_order_row;
  if not found then
    raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
  end if;

  insert into public.progress_logs (
    enterprise_id,
    work_order_id,
    operator_id,
    operator_name,
    action,
    completed_delta,
    remark
  ) values (
    target_enterprise_id,
    work_order_row.id,
    auth.uid(),
    operator_display_name,
    target_action,
    target_completed_delta,
    target_remark
  )
  returning * into log_row;

  return jsonb_build_object(
    'work_order', jsonb_build_object(
      'id', work_order_row.id,
      'status', work_order_row.status,
      'completed_quantity', work_order_row.completed_quantity
    ),
    'log', jsonb_build_object(
      'id', log_row.id,
      'work_order_id', log_row.work_order_id,
      'operator_id', log_row.operator_id,
      'operator_name', log_row.operator_name,
      'action', log_row.action,
      'completed_delta', log_row.completed_delta,
      'remark', log_row.remark,
      'created_at', log_row.created_at
    )
  );
end;
$$;

create or replace function public.create_production_tasks(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_tasks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  task_input jsonb;
  created_task public.production_tasks%rowtype;
  result_rows jsonb := '[]'::jsonb;
  initial_status text;
  task_workshop_id uuid;
  task_workstation_id uuid;
  task_worker_id uuid;
  task_wage_rule_id uuid;
  task_estimated_wage numeric;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if not app_private.has_permission(target_enterprise_id, 'production.plan') then
    raise exception using errcode = '42501', message = 'PRODUCTION_PLAN_FORBIDDEN';
  end if;
  if jsonb_typeof(target_tasks) <> 'array'
    or jsonb_array_length(target_tasks) < 1
    or jsonb_array_length(target_tasks) > 500 then
    raise exception using errcode = '22023', message = 'PRODUCTION_TASKS_INPUT_INVALID';
  end if;
  if not exists (
    select 1 from public.orders order_row
    where order_row.enterprise_id = target_enterprise_id
      and order_row.id = target_order_id
      and order_row.status not in ('completed', 'cancelled', 'rejected', 'withdrawn')
  ) then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND_OR_CLOSED';
  end if;

  for task_input in select value from jsonb_array_elements(target_tasks)
  loop
    if jsonb_typeof(task_input) <> 'object'
      or task_input - array[
        'id', 'work_order_id', 'space_id', 'product_id', 'task_no', 'task_type',
        'task_name', 'task_code', 'product_name', 'quantity', 'unit', 'length',
        'width', 'thickness', 'area', 'material', 'color', 'process_name',
        'priority', 'progress', 'workshop_id', 'workstation_id',
        'assigned_worker_id', 'wage_rule_id', 'estimated_wage_amount',
        'planned_start_date', 'planned_end_date', 'remark', 'initial_status'
      ] <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'PRODUCTION_TASK_INPUT_INVALID';
    end if;

    initial_status := coalesce(nullif(task_input ->> 'initial_status', ''), 'pending_generate');
    task_workshop_id := nullif(task_input ->> 'workshop_id', '')::uuid;
    task_workstation_id := nullif(task_input ->> 'workstation_id', '')::uuid;
    task_worker_id := nullif(task_input ->> 'assigned_worker_id', '')::uuid;
    task_wage_rule_id := nullif(task_input ->> 'wage_rule_id', '')::uuid;
    task_estimated_wage := coalesce((task_input ->> 'estimated_wage_amount')::numeric, 0);

    if initial_status not in ('pending_generate', 'pending_assign', 'assigned')
      or nullif(btrim(task_input ->> 'task_no'), '') is null
      or nullif(btrim(task_input ->> 'task_name'), '') is null
      or nullif(btrim(task_input ->> 'product_name'), '') is null
      or coalesce((task_input ->> 'quantity')::numeric, 0) <= 0
      or char_length(coalesce(task_input ->> 'task_name', '')) > 200
      or char_length(coalesce(task_input ->> 'remark', '')) > 2000
      or coalesce(nullif(task_input ->> 'task_type', ''), 'process') not in (
        'board', 'door', 'special', 'hardware',
        'process', 'cutting', 'edge_banding', 'drilling', 'polishing', 'veneer',
        'painting', 'assembly', 'install', 'package', 'delivery'
      )
      or task_estimated_wage < 0
      or task_estimated_wage <> trunc(task_estimated_wage) then
      raise exception using errcode = '22023', message = 'PRODUCTION_TASK_INPUT_INVALID';
    end if;
    if (task_worker_id is null and initial_status = 'assigned')
      or (task_worker_id is not null and initial_status <> 'assigned') then
      raise exception using errcode = '22023', message = 'PRODUCTION_TASK_ASSIGNMENT_INVALID';
    end if;

    if nullif(task_input ->> 'work_order_id', '') is not null and not exists (
      select 1 from public.work_orders work_order
      where work_order.enterprise_id = target_enterprise_id
        and work_order.id = (task_input ->> 'work_order_id')::uuid
        and work_order.order_id = target_order_id
    ) then
      raise exception using errcode = 'P0002', message = 'WORK_ORDER_NOT_FOUND';
    end if;
    if nullif(task_input ->> 'space_id', '') is not null and not exists (
      select 1 from public.order_spaces space
      where space.enterprise_id = target_enterprise_id
        and space.id = (task_input ->> 'space_id')::uuid
        and space.order_id = target_order_id
    ) then
      raise exception using errcode = 'P0002', message = 'SPACE_NOT_FOUND';
    end if;
    if nullif(task_input ->> 'product_id', '') is not null and not exists (
      select 1 from public.order_products product
      where product.enterprise_id = target_enterprise_id
        and product.id = (task_input ->> 'product_id')::uuid
        and product.order_id = target_order_id
        and (
          nullif(task_input ->> 'space_id', '') is null
          or product.space_id = (task_input ->> 'space_id')::uuid
        )
    ) then
      raise exception using errcode = 'P0002', message = 'PRODUCT_NOT_FOUND';
    end if;

    if task_workshop_id is null
      and not app_private.has_enterprise_permission(target_enterprise_id, 'production.plan') then
      raise exception using errcode = '42501', message = 'PRODUCTION_WORKSHOP_FORBIDDEN';
    end if;
    if task_workshop_id is not null
      and not app_private.can_access_workshop(target_enterprise_id, 'production.plan', task_workshop_id) then
      raise exception using errcode = '42501', message = 'PRODUCTION_WORKSHOP_FORBIDDEN';
    end if;
    if task_workstation_id is not null and not exists (
      select 1 from public.workstations workstation
      where workstation.tenant_id = target_enterprise_id
        and workstation.id = task_workstation_id
        and workstation.workshop_id = task_workshop_id
        and workstation.status = 'active'
    ) then
      raise exception using errcode = 'P0002', message = 'WORKSTATION_NOT_FOUND';
    end if;

    if task_worker_id is not null then
      if not app_private.has_permission(target_enterprise_id, 'production.assign') then
        raise exception using errcode = '42501', message = 'PRODUCTION_ASSIGN_FORBIDDEN';
      end if;
      if task_workshop_id is null
        and not app_private.has_enterprise_permission(target_enterprise_id, 'production.assign') then
        raise exception using errcode = '42501', message = 'PRODUCTION_ASSIGN_FORBIDDEN';
      end if;
      if task_workshop_id is not null
        and not app_private.can_access_workshop(target_enterprise_id, 'production.assign', task_workshop_id) then
        raise exception using errcode = '42501', message = 'PRODUCTION_ASSIGN_FORBIDDEN';
      end if;
      if not exists (
        select 1 from public.workers worker
        where worker.enterprise_id = target_enterprise_id
          and worker.id = task_worker_id
          and worker.status = 'active'
          and worker.can_receive_production_task = true
          and (task_workshop_id is null or worker.workshop_id = task_workshop_id)
      ) then
        raise exception using errcode = 'P0002', message = 'ASSIGNABLE_WORKER_NOT_FOUND';
      end if;
    end if;

    if task_wage_rule_id is not null or task_estimated_wage <> 0 then
      if not app_private.has_permission(target_enterprise_id, 'wages.manage') then
        raise exception using errcode = '42501', message = 'PRODUCTION_WAGE_FORBIDDEN';
      end if;
      if task_workshop_id is null
        and not app_private.has_enterprise_permission(target_enterprise_id, 'wages.manage') then
        raise exception using errcode = '42501', message = 'PRODUCTION_WAGE_FORBIDDEN';
      end if;
      if task_workshop_id is not null
        and not app_private.can_access_workshop(target_enterprise_id, 'wages.manage', task_workshop_id) then
        raise exception using errcode = '42501', message = 'PRODUCTION_WAGE_FORBIDDEN';
      end if;
      if task_wage_rule_id is null or not exists (
        select 1 from public.wage_rules wage_rule
        where wage_rule.enterprise_id = target_enterprise_id
          and wage_rule.id = task_wage_rule_id
          and wage_rule.enabled = true
      ) then
        raise exception using errcode = 'P0002', message = 'WAGE_RULE_NOT_FOUND';
      end if;
    end if;

    insert into public.production_tasks (
      id, enterprise_id, work_order_id, order_id, space_id, product_id,
      task_no, task_type, task_name, task_code, product_name, quantity, unit,
      length, width, thickness, area, material, color, process_name,
      priority, progress, worker_id, assigned_worker_id, workshop_id,
      workstation_id, wage_rule_id, estimated_wage_amount, final_wage_amount,
      planned_start_date, planned_end_date, status, remark, updated_at
    ) values (
      coalesce(nullif(task_input ->> 'id', '')::uuid, gen_random_uuid()),
      target_enterprise_id,
      nullif(task_input ->> 'work_order_id', '')::uuid,
      target_order_id,
      nullif(task_input ->> 'space_id', '')::uuid,
      nullif(task_input ->> 'product_id', '')::uuid,
      btrim(task_input ->> 'task_no'),
      coalesce(nullif(task_input ->> 'task_type', ''), 'process'),
      btrim(task_input ->> 'task_name'),
      nullif(btrim(task_input ->> 'task_code'), ''),
      btrim(task_input ->> 'product_name'),
      (task_input ->> 'quantity')::numeric,
      coalesce(nullif(task_input ->> 'unit', ''), '件'),
      (task_input ->> 'length')::numeric,
      (task_input ->> 'width')::numeric,
      (task_input ->> 'thickness')::numeric,
      (task_input ->> 'area')::numeric,
      nullif(task_input ->> 'material', ''),
      nullif(task_input ->> 'color', ''),
      nullif(task_input ->> 'process_name', ''),
      coalesce((task_input ->> 'priority')::integer, 0),
      coalesce(nullif(task_input ->> 'progress', ''), 'pending'),
      task_worker_id,
      task_worker_id,
      task_workshop_id,
      task_workstation_id,
      task_wage_rule_id,
      task_estimated_wage,
      0,
      (task_input ->> 'planned_start_date')::date,
      (task_input ->> 'planned_end_date')::date,
      initial_status,
      nullif(task_input ->> 'remark', ''),
      now()
    ) returning * into created_task;

    result_rows := result_rows || jsonb_build_array(app_private.safe_production_task(created_task));
  end loop;

  return result_rows;
end;
$$;

create or replace function public.confirm_order_task_drafts(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_expected_status text,
  target_remark text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  task_row public.production_tasks%rowtype;
  order_row public.orders%rowtype;
  result_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if not app_private.has_permission(target_enterprise_id, 'production.plan') then
    raise exception using errcode = '42501', message = 'PRODUCTION_PLAN_FORBIDDEN';
  end if;
  select * into order_row
  from public.orders target_order
  where target_order.enterprise_id = target_enterprise_id
    and target_order.id = target_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if order_row.status <> target_expected_status then
    raise exception using errcode = 'P0001', message = 'ORDER_STATUS_CONFLICT';
  end if;
  if order_row.status not in ('confirmed', 'accepted') then
    raise exception using errcode = 'P0001', message = 'ORDER_STATUS_TRANSITION_INVALID';
  end if;

  for task_row in
    select * from public.production_tasks task
    where task.enterprise_id = target_enterprise_id
      and task.order_id = target_order_id
      and task.status = 'pending_generate'
    for update
  loop
    if task_row.workshop_id is null
      and not app_private.has_enterprise_permission(target_enterprise_id, 'production.plan') then
      raise exception using errcode = '42501', message = 'PRODUCTION_WORKSHOP_FORBIDDEN';
    end if;
    if task_row.workshop_id is not null
      and not app_private.can_access_workshop(target_enterprise_id, 'production.plan', task_row.workshop_id) then
      raise exception using errcode = '42501', message = 'PRODUCTION_WORKSHOP_FORBIDDEN';
    end if;
    update public.production_tasks
    set status = 'pending_assign', updated_at = now()
    where enterprise_id = target_enterprise_id
      and id = task_row.id
      and status = 'pending_generate'
    returning * into task_row;
    if not found then
      raise exception using errcode = 'P0001', message = 'TASK_STATUS_CONFLICT';
    end if;
    result_rows := result_rows || jsonb_build_array(app_private.safe_production_task(task_row));
  end loop;

  if jsonb_array_length(result_rows) = 0 then
    return jsonb_build_object('tasks', result_rows, 'order', null);
  end if;

  update public.orders
  set status = 'pool', updated_at = now()
  where enterprise_id = target_enterprise_id
    and id = target_order_id
    and status = target_expected_status
  returning * into order_row;
  if not found then
    raise exception using errcode = 'P0001', message = 'ORDER_STATUS_CONFLICT';
  end if;

  insert into public.order_status_logs (
    enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
  ) values (
    target_enterprise_id, 'order', target_order_id, target_expected_status, 'pool',
    auth.uid(), coalesce(target_remark, '确认拆单，订单进入待排产')
  );

  return jsonb_build_object(
    'tasks', result_rows,
    'order', jsonb_build_object('id', order_row.id, 'status', order_row.status)
  );
end;
$$;

create or replace function public.transition_order_component_status(
  target_enterprise_id uuid,
  target_type text,
  target_id uuid,
  target_expected_status text,
  target_status text,
  target_remark text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  existing_status text;
  required_permission text;
  transition_allowed boolean := false;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if target_type is null or target_type not in ('space', 'product') then
    raise exception using errcode = '22023', message = 'COMPONENT_TYPE_INVALID';
  end if;
  if target_status is null or target_status not in (
    'draft', 'pending', 'submitted', 'reviewed', 'confirmed', 'pool', 'accepted',
    'producing', 'partially_completed', 'ready_to_ship', 'shipped', 'completed',
    'cancelled', 'returned', 'rejected', 'withdrawn', 'abnormal'
  ) then
    raise exception using errcode = '22023', message = 'COMPONENT_STATUS_INVALID';
  end if;

  if target_type = 'space' then
    select status into existing_status
    from public.order_spaces
    where enterprise_id = target_enterprise_id and id = target_id
    for update;
  else
    select status into existing_status
    from public.order_products
    where enterprise_id = target_enterprise_id and id = target_id
    for update;
  end if;
  if not found then
    raise exception using errcode = 'P0002', message = 'COMPONENT_NOT_FOUND';
  end if;
  if existing_status <> target_expected_status then
    raise exception using errcode = 'P0001', message = 'COMPONENT_STATUS_CONFLICT';
  end if;

  transition_allowed := target_status = existing_status
    or (existing_status = 'draft' and target_status in ('pending', 'producing', 'abnormal', 'cancelled'))
    or (existing_status = 'pending' and target_status in ('draft', 'submitted', 'producing', 'abnormal', 'returned', 'cancelled'))
    or (existing_status = 'submitted' and target_status in ('reviewed', 'returned', 'cancelled'))
    or (existing_status = 'reviewed' and target_status in ('confirmed', 'returned', 'cancelled'))
    or (existing_status = 'returned' and target_status in ('pending', 'cancelled'))
    or (existing_status in ('confirmed', 'accepted') and target_status in ('pool', 'producing', 'abnormal', 'cancelled'))
    or (existing_status = 'pool' and target_status in ('producing', 'abnormal', 'cancelled'))
    or (existing_status = 'producing' and target_status in ('partially_completed', 'ready_to_ship', 'completed', 'abnormal', 'cancelled'))
    or (existing_status = 'partially_completed' and target_status in ('producing', 'ready_to_ship', 'completed', 'abnormal', 'cancelled'))
    or (existing_status = 'abnormal' and target_status in ('producing', 'completed', 'cancelled'))
    or (existing_status = 'ready_to_ship' and target_status in ('shipped', 'cancelled'))
    or (existing_status = 'shipped' and target_status = 'completed');
  if not transition_allowed then
    raise exception using errcode = '22023', message = 'COMPONENT_STATUS_TRANSITION_INVALID';
  end if;

  required_permission := case
    when target_status in ('reviewed', 'confirmed', 'accepted') then 'orders.accept'
    when target_status = 'pool' then 'production.plan'
    when target_status in ('producing', 'partially_completed', 'ready_to_ship', 'completed', 'abnormal') then 'production.manage'
    when target_status = 'shipped' then 'shipping.manage'
    else 'orders.update'
  end;
  if not app_private.has_enterprise_permission(target_enterprise_id, required_permission) then
    raise exception using errcode = '42501', message = 'COMPONENT_STATUS_FORBIDDEN';
  end if;

  if target_status <> existing_status then
    if target_type = 'space' then
      update public.order_spaces
      set status = target_status, updated_at = now()
      where enterprise_id = target_enterprise_id
        and id = target_id
        and status = target_expected_status;
    else
      update public.order_products
      set status = target_status, updated_at = now()
      where enterprise_id = target_enterprise_id
        and id = target_id
        and status = target_expected_status;
    end if;
    if not found then
      raise exception using errcode = 'P0001', message = 'COMPONENT_STATUS_CONFLICT';
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
      target_type,
      target_id,
      target_expected_status,
      target_status,
      actor_id,
      target_remark
    );
  end if;

  return jsonb_build_object('id', target_id, 'status', target_status);
end;
$$;

create or replace function public.audit_initial_order_resource_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  resource_type text;
begin
  resource_type := case tg_table_name
    when 'order_spaces' then 'space'
    when 'order_products' then 'product'
    when 'production_tasks' then 'production_task'
    else null
  end;
  if resource_type is null then
    raise exception using errcode = '22023', message = 'AUDIT_RESOURCE_TYPE_INVALID';
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
    new.enterprise_id,
    resource_type,
    new.id,
    null,
    new.status,
    auth.uid(),
    '创建记录'
  );
  return new;
end;
$$;

create or replace function public.audit_confirmed_production_task_draft()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.order_status_logs (
    enterprise_id,
    target_type,
    target_id,
    from_status,
    to_status,
    changed_by,
    remark
  ) values (
    new.enterprise_id,
    'production_task',
    new.id,
    old.status,
    new.status,
    auth.uid(),
    '确认拆单，进入待分配'
  );
  return new;
end;
$$;

drop trigger if exists audit_order_space_initial_status on public.order_spaces;
create trigger audit_order_space_initial_status
after insert on public.order_spaces
for each row execute function public.audit_initial_order_resource_status();

drop trigger if exists audit_order_product_initial_status on public.order_products;
create trigger audit_order_product_initial_status
after insert on public.order_products
for each row execute function public.audit_initial_order_resource_status();

drop trigger if exists audit_production_task_initial_status on public.production_tasks;
create trigger audit_production_task_initial_status
after insert on public.production_tasks
for each row execute function public.audit_initial_order_resource_status();

drop trigger if exists audit_production_task_draft_confirmation on public.production_tasks;
create trigger audit_production_task_draft_confirmation
after update of status on public.production_tasks
for each row
when (old.status = 'pending_generate' and new.status = 'pending_assign')
execute function public.audit_confirmed_production_task_draft();

alter function public.report_work_order_progress(uuid, uuid, text, numeric, text)
  owner to v2_function_owner;
alter function public.create_production_tasks(uuid, uuid, jsonb)
  owner to v2_function_owner;
alter function public.confirm_order_task_drafts(uuid, uuid, text, text)
  owner to v2_function_owner;
alter function public.transition_order_component_status(uuid, text, uuid, text, text, text)
  owner to v2_function_owner;
alter function public.audit_initial_order_resource_status()
  owner to v2_function_owner;
alter function public.audit_confirmed_production_task_draft()
  owner to v2_function_owner;

revoke all on function public.report_work_order_progress(uuid, uuid, text, numeric, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_production_tasks(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.confirm_order_task_drafts(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.transition_order_component_status(uuid, text, uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.audit_initial_order_resource_status()
  from public, anon, authenticated, service_role;
revoke all on function public.audit_confirmed_production_task_draft()
  from public, anon, authenticated, service_role;
grant execute on function public.report_work_order_progress(uuid, uuid, text, numeric, text)
  to authenticated;
grant execute on function public.create_production_tasks(uuid, uuid, jsonb)
  to authenticated;
grant execute on function public.confirm_order_task_drafts(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.transition_order_component_status(uuid, text, uuid, text, text, text)
  to authenticated;

drop policy if exists progress_logs_insert on public.progress_logs;
drop policy if exists progress_logs_update on public.progress_logs;
drop policy if exists progress_logs_delete on public.progress_logs;
drop policy if exists order_status_logs_insert on public.order_status_logs;
drop policy if exists order_status_logs_update on public.order_status_logs;
drop policy if exists order_status_logs_delete on public.order_status_logs;
drop policy if exists production_tasks_insert on public.production_tasks;
drop policy if exists production_tasks_update on public.production_tasks;
drop policy if exists production_tasks_delete on public.production_tasks;
drop policy if exists work_orders_insert on public.work_orders;
drop policy if exists work_orders_update on public.work_orders;
drop policy if exists work_orders_delete on public.work_orders;

revoke insert, update, delete on table public.progress_logs from authenticated;
revoke insert, update, delete on table public.order_status_logs from authenticated;
revoke insert, update, delete on table public.production_tasks from authenticated;
revoke insert, update, delete on table public.work_orders from authenticated;

revoke insert on table public.order_spaces from authenticated;
grant insert (
  id,
  enterprise_id,
  order_id,
  space_no,
  space_name,
  space_type,
  sort_order,
  remark,
  created_at,
  updated_at
) on table public.order_spaces to authenticated;
revoke update on table public.order_spaces from authenticated;
grant update (
  space_no,
  space_name,
  space_type,
  sort_order,
  remark,
  updated_at
) on table public.order_spaces to authenticated;
revoke update (status) on table public.order_products from authenticated;

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
