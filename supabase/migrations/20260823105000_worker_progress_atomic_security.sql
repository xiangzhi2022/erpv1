-- Narrow worker/progress access to the caller's enterprise and workshop scope.
drop policy if exists production_tasks_select on public.production_tasks;
create policy production_tasks_select on public.production_tasks
for select to authenticated
using (
  app_private.has_permission(enterprise_id, 'production.read')
  and (
    (workshop_id is null and app_private.has_enterprise_permission(enterprise_id, 'production.read'))
    or app_private.can_access_workshop(enterprise_id, 'production.read', workshop_id)
  )
);

drop policy if exists work_orders_select on public.work_orders;
create policy work_orders_select on public.work_orders
for select to authenticated
using (
  app_private.has_permission(enterprise_id, 'production.read')
  and (
    (workshop_id is null and app_private.has_enterprise_permission(enterprise_id, 'production.read'))
    or app_private.can_access_workshop(enterprise_id, 'production.read', workshop_id)
  )
);

drop policy if exists progress_logs_select on public.progress_logs;
create policy progress_logs_select on public.progress_logs
for select to authenticated
using (
  app_private.has_permission(enterprise_id, 'production.read')
  and exists (
    select 1
    from public.work_orders work_order
    where work_order.enterprise_id = progress_logs.enterprise_id
      and work_order.id = progress_logs.work_order_id
      and (
        (work_order.workshop_id is null and app_private.has_enterprise_permission(progress_logs.enterprise_id, 'production.read'))
        or app_private.can_access_workshop(progress_logs.enterprise_id, 'production.read', work_order.workshop_id)
      )
  )
);

drop policy if exists workers_select on public.workers;
create policy workers_select on public.workers
for select to authenticated
using (
  (
    app_private.has_permission(enterprise_id, 'members.read')
    and (
      (workshop_id is null and app_private.has_enterprise_permission(enterprise_id, 'members.read'))
      or app_private.can_access_workshop(enterprise_id, 'members.read', workshop_id)
    )
  )
  or (
    app_private.has_permission(enterprise_id, 'production.read')
    and (
      (workshop_id is null and app_private.has_enterprise_permission(enterprise_id, 'production.read'))
      or app_private.can_access_workshop(enterprise_id, 'production.read', workshop_id)
    )
  )
  or (
    app_private.has_permission(enterprise_id, 'wages.manage')
    and (
      (workshop_id is null and app_private.has_enterprise_permission(enterprise_id, 'wages.manage'))
      or app_private.can_access_workshop(enterprise_id, 'wages.manage', workshop_id)
    )
  )
);

drop policy if exists workers_select_self on public.workers;
create policy workers_select_self on public.workers
for select to authenticated
using (
  user_id = (select auth.uid())
  and app_private.is_active_member(enterprise_id)
);

drop policy if exists positions_wages_manage_select on public.positions;
create policy positions_wages_manage_select on public.positions
for select to authenticated
using (app_private.has_enterprise_permission(enterprise_id, 'wages.manage'));

drop policy if exists worker_wage_records_select on public.worker_wage_records;
create policy worker_wage_records_select on public.worker_wage_records
for select to authenticated
using (
  app_private.has_permission(enterprise_id, 'wages.read.all')
  or (
    app_private.has_permission(enterprise_id, 'wages.read.self')
    and exists (
      select 1
      from public.workers worker
      where worker.enterprise_id = worker_wage_records.enterprise_id
        and worker.id = worker_wage_records.worker_id
        and worker.user_id = (select auth.uid())
    )
  )
);

grant select on table public.enterprise_memberships, public.orders, public.workers, public.production_tasks, public.work_orders to v2_function_owner;
grant update on table public.production_tasks, public.work_orders to v2_function_owner;
grant insert on table public.work_orders, public.progress_logs to v2_function_owner;

create or replace function public.report_worker_task(
  target_enterprise_id uuid,
  target_task_id uuid,
  target_action text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  bound_worker_id uuid;
  task_row public.production_tasks%rowtype;
  operator_display_name text;
  expected_status text;
  next_status text;
  now_at timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if not app_private.has_permission(target_enterprise_id, 'production.report.self') then
    raise exception using errcode = '42501', message = 'PRODUCTION_REPORT_FORBIDDEN';
  end if;
  select membership.display_name into operator_display_name
  from public.enterprise_memberships membership
  where membership.tenant_id = target_enterprise_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active';
  if operator_display_name is null then
    raise exception using errcode = '42501', message = 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;
  select worker.id into bound_worker_id
  from public.workers worker
  where worker.enterprise_id = target_enterprise_id
    and worker.user_id = (select auth.uid())
    and worker.status = 'active';
  if bound_worker_id is null then
    raise exception using errcode = '42501', message = 'WORKER_BINDING_REQUIRED';
  end if;
  select * into task_row
  from public.production_tasks task
  where task.enterprise_id = target_enterprise_id
    and task.id = target_task_id
  for update;
  if task_row.id is null then
    raise exception using errcode = 'P0002', message = 'TASK_NOT_FOUND';
  end if;
  if task_row.worker_id is distinct from bound_worker_id
    and task_row.assigned_worker_id is distinct from bound_worker_id then
    raise exception using errcode = '42501', message = 'TASK_NOT_OWNED';
  end if;
  if task_row.workshop_id is not null
    and not app_private.can_access_workshop(target_enterprise_id, 'production.report.self', task_row.workshop_id) then
    raise exception using errcode = '42501', message = 'WORKSHOP_ACCESS_FORBIDDEN';
  end if;
  if task_row.workshop_id is null
    and not app_private.has_enterprise_permission(target_enterprise_id, 'production.report.self') then
    raise exception using errcode = '42501', message = 'WORKSHOP_ACCESS_FORBIDDEN';
  end if;
  if target_action = 'start' then
    expected_status := 'pending'; next_status := 'processing';
  elsif target_action = 'complete' then
    expected_status := 'processing'; next_status := 'completed';
  else
    raise exception using errcode = '22023', message = 'INVALID_TASK_ACTION';
  end if;
  if task_row.status <> expected_status then
    raise exception using errcode = 'P0001', message = 'TASK_STATUS_CONFLICT';
  end if;
  update public.production_tasks
  set status = next_status,
      updated_at = now_at,
      start_date = case when next_status = 'processing' and task_row.start_date is null then now_at else start_date end,
      end_date = case when next_status = 'completed' then now_at else end_date end
  where enterprise_id = target_enterprise_id
    and id = task_row.id
    and status = expected_status;
  if not found then
    raise exception using errcode = 'P0001', message = 'TASK_STATUS_CONFLICT';
  end if;
  if task_row.work_order_id is not null then
    insert into public.progress_logs (enterprise_id, work_order_id, operator_id, operator_name, action, completed_delta, remark)
    values (target_enterprise_id, task_row.work_order_id, (select auth.uid()), operator_display_name, 'report_progress', 0, concat('工人任务', target_action));
  end if;
  -- This RPC intentionally does not update orders: callers with self-report
  -- permission must not gain an implicit order-update capability.
  return jsonb_build_object('status', next_status, 'message', case when next_status = 'completed' then '任务已完成' else '任务已开始' end);
end;
$$;

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
  next_status text;
  next_completed_quantity numeric;
  now_at timestamptz := now();
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if target_completed_delta < 0 then
    raise exception using errcode = '22023', message = 'INVALID_COMPLETED_DELTA';
  end if;
  if not app_private.has_permission(target_enterprise_id, 'production.report.self') then
    raise exception using errcode = '42501', message = 'PRODUCTION_REPORT_FORBIDDEN';
  end if;
  select membership.display_name into operator_display_name
  from public.enterprise_memberships membership
  where membership.tenant_id = target_enterprise_id
    and membership.user_id = (select auth.uid())
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
    and not app_private.can_access_workshop(target_enterprise_id, 'production.report.self', work_order_row.workshop_id) then
    raise exception using errcode = '42501', message = 'WORKSHOP_ACCESS_FORBIDDEN';
  end if;
  if work_order_row.workshop_id is null
    and not app_private.has_enterprise_permission(target_enterprise_id, 'production.report.self') then
    raise exception using errcode = '42501', message = 'WORKSHOP_ACCESS_FORBIDDEN';
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
      if work_order_row.status not in ('pending', 'scheduling') then raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT'; end if;
      next_status := 'producing';
    when 'complete_cutting', 'complete_assembly', 'complete_painting' then
      if work_order_row.status <> 'producing' then raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT'; end if;
      next_status := 'producing';
    when 'quality_check' then
      if work_order_row.status <> 'producing' then raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT'; end if;
      next_status := 'inspecting';
    when 'warehouse_in' then
      if work_order_row.status <> 'inspecting' then raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT'; end if;
      next_status := 'stored';
    when 'report_progress', 'report_defect' then
      if work_order_row.status not in ('producing', 'inspecting') then raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT'; end if;
      next_status := work_order_row.status;
    when 'pause' then
      if work_order_row.status <> 'producing' then raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT'; end if;
      next_status := 'pending';
    when 'resume' then
      if work_order_row.status <> 'pending' then raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT'; end if;
      next_status := 'producing';
    when 'abort' then
      next_status := 'aborted';
    else
      raise exception using errcode = '22023', message = 'INVALID_WORK_ORDER_ACTION';
  end case;
  if next_completed_quantity >= work_order_row.target_quantity and target_action not in ('abort', 'warehouse_in') then
    next_status := 'inspecting';
  end if;
  update public.work_orders
  set status = next_status,
      completed_quantity = next_completed_quantity,
      updated_at = now_at,
      start_date = case when next_status = 'producing' and work_order_row.status <> 'producing' then now_at else start_date end,
      actual_end_date = case when next_status = 'stored' then now_at else actual_end_date end
  where enterprise_id = target_enterprise_id
    and id = work_order_row.id
    and status = work_order_row.status
  returning * into work_order_row;
  if not found then
    raise exception using errcode = 'P0001', message = 'WORK_ORDER_STATUS_CONFLICT';
  end if;
  insert into public.progress_logs (enterprise_id, work_order_id, operator_id, operator_name, action, completed_delta, remark)
  values (target_enterprise_id, work_order_row.id, (select auth.uid()), operator_display_name, target_action, target_completed_delta, target_remark)
  returning * into log_row;
  return jsonb_build_object(
    'work_order', jsonb_build_object('id', work_order_row.id, 'status', work_order_row.status, 'completed_quantity', work_order_row.completed_quantity),
    'log', jsonb_build_object('id', log_row.id, 'work_order_id', log_row.work_order_id, 'operator_id', log_row.operator_id, 'operator_name', log_row.operator_name, 'action', log_row.action, 'completed_delta', log_row.completed_delta, 'remark', log_row.remark, 'created_at', log_row.created_at)
  );
end;
$$;

create or replace function public.create_production_work_order(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_workshop_id uuid,
  target_product_name text,
  target_quantity numeric,
  target_priority text,
  target_expected_end_date timestamptz,
  target_remark text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  created_work_order public.work_orders%rowtype;
  operator_display_name text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if target_product_name is null or char_length(btrim(target_product_name)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_NAME';
  end if;
  if target_quantity is null or target_quantity <= 0 or target_quantity <> trunc(target_quantity) then
    raise exception using errcode = '22023', message = 'INVALID_TARGET_QUANTITY';
  end if;
  if target_priority is null or target_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception using errcode = '22023', message = 'INVALID_PRIORITY';
  end if;
  if target_expected_end_date is not null and target_expected_end_date < date_trunc('day', now()) then
    raise exception using errcode = '22023', message = 'INVALID_EXPECTED_END_DATE';
  end if;
  if target_remark is not null and char_length(btrim(target_remark)) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_REMARK';
  end if;
  if not app_private.has_permission(target_enterprise_id, 'production.plan') then
    raise exception using errcode = '42501', message = 'PRODUCTION_PLAN_FORBIDDEN';
  end if;
  select membership.display_name into operator_display_name
  from public.enterprise_memberships membership
  where membership.tenant_id = target_enterprise_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active';
  if operator_display_name is null then
    raise exception using errcode = '42501', message = 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;
  if target_workshop_id is null then
    if not app_private.has_enterprise_permission(target_enterprise_id, 'production.plan') then
      raise exception using errcode = '42501', message = 'WORKSHOP_ACCESS_FORBIDDEN';
    end if;
  elsif not app_private.can_access_workshop(target_enterprise_id, 'production.plan', target_workshop_id) then
    raise exception using errcode = '42501', message = 'WORKSHOP_ACCESS_FORBIDDEN';
  end if;
  if target_order_id is not null and not exists (
    select 1
    from public.orders order_row
    where order_row.enterprise_id = target_enterprise_id
      and order_row.id = target_order_id
  ) then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  insert into public.work_orders (
    enterprise_id, order_id, workshop_id, product_name, target_quantity,
    completed_quantity, status, priority, expected_end_date, remark
  ) values (
    target_enterprise_id, target_order_id, target_workshop_id, btrim(target_product_name), target_quantity,
    0, 'pending', target_priority, target_expected_end_date, nullif(btrim(target_remark), '')
  ) returning * into created_work_order;
  insert into public.progress_logs (
    enterprise_id, work_order_id, operator_id, operator_name, action, completed_delta, remark
  ) values (
    target_enterprise_id, created_work_order.id, (select auth.uid()), operator_display_name, 'start', 0, '工单创建'
  );
  return jsonb_build_object(
    'id', created_work_order.id,
    'order_id', created_work_order.order_id,
    'workshop_id', created_work_order.workshop_id,
    'product_name', created_work_order.product_name,
    'target_quantity', created_work_order.target_quantity,
    'completed_quantity', created_work_order.completed_quantity,
    'status', created_work_order.status,
    'priority', created_work_order.priority,
    'expected_end_date', created_work_order.expected_end_date,
    'remark', created_work_order.remark
  );
end;
$$;

alter function public.report_worker_task(uuid, uuid, text) owner to v2_function_owner;
alter function public.report_work_order_progress(uuid, uuid, text, numeric, text) owner to v2_function_owner;
alter function public.create_production_work_order(uuid, uuid, uuid, text, numeric, text, timestamptz, text) owner to v2_function_owner;
revoke all on function public.report_worker_task(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.report_work_order_progress(uuid, uuid, text, numeric, text) from public, anon, authenticated, service_role;
revoke all on function public.create_production_work_order(uuid, uuid, uuid, text, numeric, text, timestamptz, text) from public, anon, authenticated, service_role;
grant execute on function public.report_worker_task(uuid, uuid, text) to authenticated;
grant execute on function public.report_work_order_progress(uuid, uuid, text, numeric, text) to authenticated;
grant execute on function public.create_production_work_order(uuid, uuid, uuid, text, numeric, text, timestamptz, text) to authenticated;
