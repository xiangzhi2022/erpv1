-- Narrow, transaction-safe production mutations.  These functions own the
-- status change and its audit entry so authenticated callers never need broad
-- table UPDATE or orders.update grants for routine production work.

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_roles where rolname = 'v2_function_owner'
  ) then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;

grant select, update on public.production_tasks to v2_function_owner;
grant select on public.workers to v2_function_owner;
grant select on public.workstations to v2_function_owner;
grant insert on public.order_status_logs to v2_function_owner;

create or replace function app_private.safe_production_task(task public.production_tasks)
returns jsonb
language sql
immutable
set search_path = pg_catalog
return to_jsonb(task) - array[
  'wage_rule_id', 'estimated_wage_amount', 'final_wage_amount'
];

alter function app_private.safe_production_task(public.production_tasks)
  owner to v2_function_owner;

create or replace function public.assign_production_task(
  p_enterprise_id uuid,
  p_task_id uuid,
  p_assigned_worker_id uuid,
  p_workshop_id uuid default null,
  p_workstation_id uuid default null,
  p_expected_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_task public.production_tasks%rowtype;
  v_worker public.workers%rowtype;
  v_workshop_id uuid;
  v_workstation_id uuid;
  v_previous_status text;
begin
  select * into v_task from public.production_tasks
  where id = p_task_id and enterprise_id = p_enterprise_id for update;
  if not found then raise exception 'TASK_NOT_FOUND' using errcode = 'P0002'; end if;
  if not app_private.is_active_member(v_task.enterprise_id)
    or not app_private.has_permission(v_task.enterprise_id, 'production.assign') then
    raise exception 'PRODUCTION_ASSIGN_FORBIDDEN' using errcode = '42501';
  end if;
  if (v_task.workshop_id is null and not app_private.has_enterprise_permission(v_task.enterprise_id, 'production.assign'))
    or (v_task.workshop_id is not null and not app_private.can_access_workshop(v_task.enterprise_id, 'production.assign', v_task.workshop_id)) then
    raise exception 'PRODUCTION_WORKSHOP_FORBIDDEN' using errcode = '42501';
  end if;
  if p_expected_status is not null and v_task.status <> p_expected_status then
    raise exception 'TASK_STATUS_CONFLICT' using errcode = 'P0001';
  end if;
  if v_task.status not in ('pending_assign', 'pending_start', 'assigned') then
    raise exception 'TASK_STATUS_CONFLICT' using errcode = 'P0001';
  end if;
  select * into v_worker from public.workers
  where id = p_assigned_worker_id
    and enterprise_id = v_task.enterprise_id
    and status = 'active'
    and can_receive_production_task = true;
  if not found then raise exception 'ASSIGNABLE_WORKER_NOT_FOUND' using errcode = 'P0002'; end if;
  v_workshop_id := coalesce(p_workshop_id, v_task.workshop_id);
  if (v_workshop_id is null and not app_private.has_enterprise_permission(v_task.enterprise_id, 'production.assign'))
    or (v_workshop_id is not null and not app_private.can_access_workshop(v_task.enterprise_id, 'production.assign', v_workshop_id)) then
    raise exception 'PRODUCTION_WORKSHOP_FORBIDDEN' using errcode = '42501';
  end if;
  v_workstation_id := coalesce(p_workstation_id, v_task.workstation_id);
  if v_workstation_id is not null and not exists (
    select 1 from public.workstations
    where id = v_workstation_id and tenant_id = v_task.enterprise_id
      and workshop_id = v_workshop_id and status = 'active'
  ) then
    raise exception 'WORKSTATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_previous_status := v_task.status;
  update public.production_tasks
  set assigned_worker_id = v_worker.id,
      worker_id = v_worker.id,
      workshop_id = v_workshop_id,
      workstation_id = v_workstation_id,
      status = 'assigned',
      updated_at = clock_timestamp()
  where id = v_task.id and enterprise_id = v_task.enterprise_id
  returning * into v_task;
  insert into public.order_status_logs (
    enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
  ) values (
    v_task.enterprise_id, 'production_task', v_task.id, v_previous_status,
    'assigned', auth.uid(), '分配生产任务'
  );
  return app_private.safe_production_task(v_task);
end;
$$;

create or replace function public.transition_own_production_task(
  p_enterprise_id uuid,
  p_task_id uuid,
  p_action text,
  p_expected_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_task public.production_tasks%rowtype;
  v_worker_id uuid;
  v_next_status text;
  v_previous_status text;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_task from public.production_tasks
  where id = p_task_id and enterprise_id = p_enterprise_id for update;
  if not found then raise exception 'TASK_NOT_FOUND' using errcode = 'P0002'; end if;
  if not app_private.is_active_member(v_task.enterprise_id)
    or not app_private.has_permission(v_task.enterprise_id, 'production.report.self') then
    raise exception 'PRODUCTION_REPORT_FORBIDDEN' using errcode = '42501';
  end if;
  if (v_task.workshop_id is null and not app_private.has_enterprise_permission(v_task.enterprise_id, 'production.report.self'))
    or (v_task.workshop_id is not null and not app_private.can_access_workshop(v_task.enterprise_id, 'production.report.self', v_task.workshop_id)) then
    raise exception 'PRODUCTION_WORKSHOP_FORBIDDEN' using errcode = '42501';
  end if;
  select id into v_worker_id from public.workers
  where enterprise_id = v_task.enterprise_id and user_id = auth.uid() and status = 'active'
    and id in (v_task.assigned_worker_id, v_task.worker_id)
  limit 1;
  if v_worker_id is null then raise exception 'TASK_WORKER_FORBIDDEN' using errcode = '42501'; end if;
  if p_expected_status is not null and v_task.status <> p_expected_status then
    raise exception 'TASK_STATUS_CONFLICT' using errcode = 'P0001';
  end if;
  v_previous_status := v_task.status;
  if p_action = 'start' and v_task.status in ('assigned', 'pending_start') then
    v_next_status := 'producing';
    update public.production_tasks set status = v_next_status, started_at = v_now,
      start_date = v_now, updated_at = v_now
    where id = v_task.id and enterprise_id = v_task.enterprise_id returning * into v_task;
  elsif p_action = 'submit' and v_task.status in ('producing', 'quality_failed', 'reworking') then
    v_next_status := 'submitted';
    update public.production_tasks set status = v_next_status, submitted_at = v_now,
      updated_at = v_now
    where id = v_task.id and enterprise_id = v_task.enterprise_id returning * into v_task;
  else
    raise exception 'TASK_STATUS_CONFLICT' using errcode = 'P0001';
  end if;
  insert into public.order_status_logs (
    enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
  ) values (
    v_task.enterprise_id, 'production_task', v_task.id, v_previous_status,
    v_next_status, auth.uid(), case when p_action = 'start' then '开始生产' else '工人提交完成' end
  );
  return app_private.safe_production_task(v_task);
end;
$$;

create or replace function public.review_production_task(
  p_enterprise_id uuid,
  p_task_id uuid,
  p_action text,
  p_remark text default null,
  p_expected_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_task public.production_tasks%rowtype;
  v_next_status text;
  v_now timestamptz := clock_timestamp();
  v_remark text;
  v_previous_status text;
begin
  select * into v_task from public.production_tasks
  where id = p_task_id and enterprise_id = p_enterprise_id for update;
  if not found then raise exception 'TASK_NOT_FOUND' using errcode = 'P0002'; end if;
  if not app_private.is_active_member(v_task.enterprise_id)
    or not app_private.has_permission(v_task.enterprise_id, 'production.review') then
    raise exception 'PRODUCTION_REVIEW_FORBIDDEN' using errcode = '42501';
  end if;
  if (v_task.workshop_id is null and not app_private.has_enterprise_permission(v_task.enterprise_id, 'production.review'))
    or (v_task.workshop_id is not null and not app_private.can_access_workshop(v_task.enterprise_id, 'production.review', v_task.workshop_id)) then
    raise exception 'PRODUCTION_WORKSHOP_FORBIDDEN' using errcode = '42501';
  end if;
  if p_expected_status is not null and v_task.status <> p_expected_status then
    raise exception 'TASK_STATUS_CONFLICT' using errcode = 'P0001';
  end if;
  if v_task.status not in ('submitted', 'pending_quality_check')
    or p_action not in ('approve', 'rework', 'abnormal') then
    raise exception 'TASK_STATUS_CONFLICT' using errcode = 'P0001';
  end if;
  if p_remark is not null and char_length(p_remark) > 2000 then
    raise exception 'INVALID_REMARK' using errcode = '22023';
  end if;
  v_next_status := case p_action when 'approve' then 'completed' when 'rework' then 'reworking' else 'abnormal' end;
  v_remark := coalesce(p_remark, case p_action when 'approve' then '审核通过' when 'rework' then '驳回返工' else '标记异常' end);
  v_previous_status := v_task.status;
  update public.production_tasks set status = v_next_status,
    completed_at = case when p_action = 'approve' then v_now else null end,
    end_date = case when p_action = 'approve' then v_now else null end,
    approved_at = v_now, approved_by = auth.uid(), updated_at = v_now
  where id = v_task.id and enterprise_id = v_task.enterprise_id returning * into v_task;
  insert into public.order_status_logs (
    enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
  ) values (v_task.enterprise_id, 'production_task', v_task.id, v_previous_status,
    v_next_status, auth.uid(), v_remark);
  return app_private.safe_production_task(v_task);
end;
$$;

create or replace function public.edit_production_task(
  p_enterprise_id uuid,
  p_task_id uuid,
  p_fields jsonb,
  p_expected_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_task public.production_tasks%rowtype;
  v_fields jsonb := coalesce(p_fields, '{}'::jsonb);
  v_status text := v_fields ->> 'status';
  v_workshop_id uuid;
  v_workstation_id uuid;
  v_worker_id uuid;
  v_previous_status text;
begin
  if jsonb_typeof(v_fields) <> 'object' or not exists (
    select 1 from jsonb_object_keys(v_fields) as key
    where key in ('task_name','task_code','quantity','unit','length','width','thickness','area','material','color','process_name','workshop_id','workstation_id','remark','status')
  ) or exists (
    select 1 from jsonb_object_keys(v_fields) as key
    where key not in ('task_name','task_code','quantity','unit','length','width','thickness','area','material','color','process_name','workshop_id','workstation_id','remark','status')
  ) then
    raise exception 'INVALID_TASK_FIELDS' using errcode = '22023';
  end if;
  select * into v_task from public.production_tasks
  where id = p_task_id and enterprise_id = p_enterprise_id for update;
  if not found then raise exception 'TASK_NOT_FOUND' using errcode = 'P0002'; end if;
  if not app_private.is_active_member(v_task.enterprise_id)
    or not app_private.has_permission(v_task.enterprise_id, 'production.plan') then
    raise exception 'PRODUCTION_PLAN_FORBIDDEN' using errcode = '42501';
  end if;
  if (v_task.workshop_id is null and not app_private.has_enterprise_permission(v_task.enterprise_id, 'production.plan'))
    or (v_task.workshop_id is not null and not app_private.can_access_workshop(v_task.enterprise_id, 'production.plan', v_task.workshop_id)) then
    raise exception 'PRODUCTION_WORKSHOP_FORBIDDEN' using errcode = '42501';
  end if;
  if p_expected_status is not null and v_task.status <> p_expected_status then
    raise exception 'TASK_STATUS_CONFLICT' using errcode = 'P0001';
  end if;
  if v_status is not null then
    if not app_private.has_permission(v_task.enterprise_id, 'production.manage') then
      raise exception 'PRODUCTION_MANAGE_FORBIDDEN' using errcode = '42501';
    end if;
    if (v_task.workshop_id is null and not app_private.has_enterprise_permission(v_task.enterprise_id, 'production.manage'))
      or (v_task.workshop_id is not null and not app_private.can_access_workshop(v_task.enterprise_id, 'production.manage', v_task.workshop_id)) then
      raise exception 'PRODUCTION_WORKSHOP_FORBIDDEN' using errcode = '42501';
    end if;
    if not ((v_task.status = 'pending_assign' and v_status = 'assigned')
      or (v_task.status in ('pending_start', 'assigned') and v_status = 'producing')
      or (v_task.status in ('producing', 'quality_failed', 'reworking') and v_status = 'submitted')
      or (v_task.status in ('submitted', 'pending_quality_check') and v_status in ('completed', 'reworking', 'abnormal'))) then
      raise exception 'TASK_STATUS_CONFLICT' using errcode = 'P0001';
    end if;
    if v_status = 'assigned' then
      select id into v_worker_id from public.workers
      where enterprise_id = v_task.enterprise_id and status = 'active'
        and id in (v_task.assigned_worker_id, v_task.worker_id)
      limit 1;
      if v_worker_id is null then raise exception 'ASSIGNABLE_WORKER_NOT_FOUND' using errcode = 'P0002'; end if;
    end if;
  end if;
  if v_fields ? 'remark' and char_length(coalesce(v_fields ->> 'remark', '')) > 2000 then
    raise exception 'INVALID_REMARK' using errcode = '22023';
  end if;
  v_workshop_id := case when v_fields ? 'workshop_id' then nullif(v_fields ->> 'workshop_id', '')::uuid else v_task.workshop_id end;
  if (v_workshop_id is null and not app_private.has_enterprise_permission(v_task.enterprise_id, 'production.plan'))
    or (v_workshop_id is not null and not app_private.can_access_workshop(v_task.enterprise_id, 'production.plan', v_workshop_id)) then
    raise exception 'PRODUCTION_WORKSHOP_FORBIDDEN' using errcode = '42501';
  end if;
  if v_status is not null and ((v_workshop_id is null and not app_private.has_enterprise_permission(v_task.enterprise_id, 'production.manage'))
    or (v_workshop_id is not null and not app_private.can_access_workshop(v_task.enterprise_id, 'production.manage', v_workshop_id))) then
    raise exception 'PRODUCTION_WORKSHOP_FORBIDDEN' using errcode = '42501';
  end if;
  v_workstation_id := case when v_fields ? 'workstation_id'
    then nullif(v_fields ->> 'workstation_id', '')::uuid else v_task.workstation_id end;
  if v_workstation_id is not null and not exists (
    select 1 from public.workstations
    where id = v_workstation_id and tenant_id = v_task.enterprise_id
      and workshop_id = v_workshop_id and status = 'active'
  ) then
    raise exception 'WORKSTATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_previous_status := v_task.status;
  update public.production_tasks set
    task_name = case when v_fields ? 'task_name' then v_fields ->> 'task_name' else task_name end,
    task_code = case when v_fields ? 'task_code' then v_fields ->> 'task_code' else task_code end,
    quantity = case when v_fields ? 'quantity' then (v_fields ->> 'quantity')::numeric else quantity end,
    unit = case when v_fields ? 'unit' then v_fields ->> 'unit' else unit end,
    length = case when v_fields ? 'length' then (v_fields ->> 'length')::numeric else length end,
    width = case when v_fields ? 'width' then (v_fields ->> 'width')::numeric else width end,
    thickness = case when v_fields ? 'thickness' then (v_fields ->> 'thickness')::numeric else thickness end,
    area = case when v_fields ? 'area' then (v_fields ->> 'area')::numeric else area end,
    material = case when v_fields ? 'material' then v_fields ->> 'material' else material end,
    color = case when v_fields ? 'color' then v_fields ->> 'color' else color end,
    process_name = case when v_fields ? 'process_name' then v_fields ->> 'process_name' else process_name end,
    workshop_id = v_workshop_id,
    workstation_id = v_workstation_id,
    remark = case when v_fields ? 'remark' then v_fields ->> 'remark' else remark end,
    status = coalesce(v_status, status), updated_at = clock_timestamp()
  where id = v_task.id and enterprise_id = v_task.enterprise_id returning * into v_task;
  if v_status is not null then
    insert into public.order_status_logs (
      enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
    ) values (v_task.enterprise_id, 'production_task', v_task.id, v_previous_status,
      v_status, auth.uid(), '更新任务状态');
  end if;
  return app_private.safe_production_task(v_task);
end;
$$;

alter function public.assign_production_task(uuid, uuid, uuid, uuid, uuid, text) owner to v2_function_owner;
alter function public.transition_own_production_task(uuid, uuid, text, text) owner to v2_function_owner;
alter function public.review_production_task(uuid, uuid, text, text, text) owner to v2_function_owner;
alter function public.edit_production_task(uuid, uuid, jsonb, text) owner to v2_function_owner;

revoke all on function app_private.safe_production_task(public.production_tasks) from public, anon, authenticated, service_role;
revoke all on function public.assign_production_task(uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.transition_own_production_task(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.review_production_task(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.edit_production_task(uuid, uuid, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.assign_production_task(uuid, uuid, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.transition_own_production_task(uuid, uuid, text, text) to authenticated;
grant execute on function public.review_production_task(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.edit_production_task(uuid, uuid, jsonb, text) to authenticated;

revoke create on schema public from v2_function_owner;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_auth_members membership
    where membership.roleid = 'v2_function_owner'::regrole
      and membership.member = 'postgres'::regrole
  ) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
