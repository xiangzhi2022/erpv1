-- Keep financial and wage details out of direct Data API table reads.
revoke select on table public.orders from authenticated;
grant select (
  id,
  enterprise_id,
  order_no,
  customer_name,
  customer_phone,
  customer_address,
  order_source,
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
  created_at,
  updated_at
) on table public.orders to authenticated;

revoke select on table public.order_items from authenticated;
grant select (
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

revoke select on table public.order_products from authenticated;
grant select (
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
  status,
  sort_order,
  remark,
  created_at,
  updated_at
) on table public.order_products to authenticated;

revoke select on table public.production_tasks from authenticated;
grant select (
  id,
  enterprise_id,
  order_id,
  space_id,
  product_id,
  work_order_id,
  task_no,
  task_type,
  task_name,
  task_code,
  product_name,
  quantity,
  unit,
  length,
  width,
  thickness,
  area,
  material,
  color,
  process_name,
  status,
  priority,
  progress,
  completed,
  workshop_id,
  workstation_id,
  assigned_to,
  assigned_worker_id,
  worker_id,
  planned_start_date,
  planned_end_date,
  actual_start_date,
  actual_end_date,
  start_date,
  end_date,
  started_at,
  submitted_at,
  completed_at,
  approved_by,
  approved_at,
  remark,
  created_at,
  updated_at
) on table public.production_tasks to authenticated;

revoke select on table public.employees from authenticated;
grant select (
  id,
  enterprise_id,
  user_id,
  employee_no,
  name,
  phone,
  email,
  avatar_url,
  department_id,
  primary_position_id,
  employee_type,
  status,
  hire_date,
  leave_date,
  remark,
  created_at,
  updated_at
) on table public.employees to authenticated;

-- A production.read-only worker may read only tasks assigned to their own worker row.
-- Planning, assignment, review, and production managers retain their existing scoped view.
drop policy if exists production_tasks_select on public.production_tasks;
create policy production_tasks_select on public.production_tasks
for select to authenticated
using (
  app_private.has_permission(production_tasks.enterprise_id, 'production.read')
  and (
    (
      production_tasks.workshop_id is null
      and app_private.has_enterprise_permission(production_tasks.enterprise_id, 'production.read')
    )
    or app_private.can_access_workshop(
      production_tasks.enterprise_id,
      'production.read',
      production_tasks.workshop_id
    )
  )
  and (
    (
      production_tasks.workshop_id is null
      and (
        app_private.has_enterprise_permission(production_tasks.enterprise_id, 'production.plan')
        or app_private.has_enterprise_permission(production_tasks.enterprise_id, 'production.assign')
        or app_private.has_enterprise_permission(production_tasks.enterprise_id, 'production.review')
        or app_private.has_enterprise_permission(production_tasks.enterprise_id, 'production.manage')
      )
    )
    or (
      production_tasks.workshop_id is not null
      and (
        app_private.can_access_workshop(production_tasks.enterprise_id, 'production.plan', production_tasks.workshop_id)
        or app_private.can_access_workshop(production_tasks.enterprise_id, 'production.assign', production_tasks.workshop_id)
        or app_private.can_access_workshop(production_tasks.enterprise_id, 'production.review', production_tasks.workshop_id)
        or app_private.can_access_workshop(production_tasks.enterprise_id, 'production.manage', production_tasks.workshop_id)
      )
    )
    or exists (
      select 1
      from public.workers worker
      where worker.enterprise_id = production_tasks.enterprise_id
        and worker.user_id = (select auth.uid())
        and worker.status = 'active'
        and worker.id in (
          production_tasks.assigned_worker_id,
          production_tasks.worker_id
        )
    )
  )
);

-- Enterprise-wide wage reads must not be granted by a site/workshop-scoped role.
-- The self-read branch remains row-bound to the authenticated user's worker.
drop policy if exists worker_wage_records_select on public.worker_wage_records;
create policy worker_wage_records_select on public.worker_wage_records
for select to authenticated
using (
  app_private.has_enterprise_permission(worker_wage_records.enterprise_id, 'wages.read.all')
  or (
    exists (
      select 1
      from app_private.effective_grants(worker_wage_records.enterprise_id) grant_row
      where grant_row.permission = 'wages.read.self'
        and grant_row.scope_kind in ('enterprise', 'self')
    )
    and app_private.is_active_member(worker_wage_records.enterprise_id)
    and exists (
      select 1
      from public.workers worker
      where worker.enterprise_id = worker_wage_records.enterprise_id
        and worker.id = worker_wage_records.worker_id
        and worker.user_id = (select auth.uid())
    )
  )
);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select on table public.orders, public.order_items, public.order_products, public.production_tasks, public.employees
  to v2_function_owner;

create function public.finance_read_order_details(
  target_enterprise_id uuid,
  target_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  result jsonb;
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.read') then
    raise exception 'FINANCE_READ_FORBIDDEN' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', order_row.id,
      'deposit_amount', order_row.deposit_amount,
      'cost_amount', order_row.cost_amount,
      'profit_amount', order_row.profit_amount,
      'internal_remark', order_row.internal_remark
    ),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', product_row.id,
          'quoted_amount', product_row.quoted_amount,
          'cost_amount', product_row.cost_amount,
          'profit_amount', product_row.profit_amount,
          'internal_remark', product_row.internal_remark
        )
        order by product_row.sort_order, product_row.id
      )
      from public.order_products product_row
      where product_row.enterprise_id = target_enterprise_id
        and product_row.order_id = target_order_id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item_row.id,
          'unit_price', item_row.unit_price,
          'subtotal', item_row.subtotal
        )
        order by item_row.sort_order, item_row.id
      )
      from public.order_items item_row
      where item_row.enterprise_id = target_enterprise_id
        and item_row.order_id = target_order_id
    ), '[]'::jsonb)
  ) into result
  from public.orders order_row
  where order_row.enterprise_id = target_enterprise_id
    and order_row.id = target_order_id;

  if result is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

create function public.finance_list_order_item_amounts(
  target_enterprise_id uuid,
  target_order_ids uuid[]
)
returns table (
  id uuid,
  order_id uuid,
  unit_price numeric,
  subtotal numeric
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.read') then
    raise exception 'FINANCE_READ_FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    item_row.id,
    item_row.order_id,
    item_row.unit_price,
    item_row.subtotal
  from public.order_items item_row
  where item_row.enterprise_id = target_enterprise_id
    and item_row.order_id = any(target_order_ids)
  order by item_row.order_id, item_row.sort_order, item_row.id;
end;
$$;

create function public.wages_read_order_task_amounts(
  target_enterprise_id uuid,
  target_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  result jsonb;
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.read.all') then
    raise exception 'WAGES_READ_FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.orders order_row
    where order_row.enterprise_id = target_enterprise_id
      and order_row.id = target_order_id
  ) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', task_row.id,
      'wage_rule_id', task_row.wage_rule_id,
      'estimated_wage_amount', task_row.estimated_wage_amount,
      'final_wage_amount', task_row.final_wage_amount
    )
    order by task_row.created_at, task_row.id
  ), '[]'::jsonb) into result
  from public.production_tasks task_row
  where task_row.enterprise_id = target_enterprise_id
    and task_row.order_id = target_order_id;

  return result;
end;
$$;

create function public.wages_read_employee_base_salaries(target_enterprise_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.read.all') then
    raise exception 'WAGES_READ_FORBIDDEN' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object('id', employee.id, 'base_salary', employee.base_salary)
      order by employee.id
    ), '[]'::jsonb)
    from public.employees employee
    where employee.enterprise_id = target_enterprise_id
  );
end;
$$;

-- Existing finance list RPCs also return enterprise-wide data, so scoped grants
-- must not satisfy their guards. Keep their signatures stable for current clients.
create or replace function public.finance_list_order_summaries(
  target_enterprise_id uuid,
  target_status text default null
)
returns table (
  id uuid,
  order_no text,
  customer_name text,
  status text,
  total_amount numeric,
  cost_amount numeric,
  deposit_amount numeric,
  profit_amount numeric,
  created_at timestamptz,
  updated_at timestamptz,
  labor_cost numeric,
  total_cost numeric,
  profit numeric,
  receivable_amount numeric,
  payable_amount numeric
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  can_read_wages boolean := app_private.has_enterprise_permission(
    target_enterprise_id,
    'wages.read.all'
  );
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.read') then
    raise exception 'finance permission denied' using errcode = '42501';
  end if;

  return query
  select
    order_row.id,
    order_row.order_no,
    order_row.customer_name,
    order_row.status,
    order_row.total_amount,
    order_row.cost_amount,
    order_row.deposit_amount,
    order_row.profit_amount,
    order_row.created_at,
    order_row.updated_at,
    case when can_read_wages then coalesce(wages.labor_cost, 0) else null end,
    case
      when not can_read_wages then order_row.cost_amount
      when order_row.cost_amount <> 0 then order_row.cost_amount
      else coalesce(wages.labor_cost, 0)
    end,
    case
      when not can_read_wages then order_row.profit_amount
      else order_row.total_amount - case
        when order_row.cost_amount <> 0 then order_row.cost_amount
        else coalesce(wages.labor_cost, 0)
      end
    end,
    order_row.total_amount,
    case
      when not can_read_wages then order_row.cost_amount
      when order_row.cost_amount <> 0 then order_row.cost_amount
      else coalesce(wages.labor_cost, 0)
    end
  from public.orders order_row
  left join lateral (
    select coalesce(sum(wage.wage_amount), 0) as labor_cost
    from public.worker_wage_records wage
    where can_read_wages
      and wage.enterprise_id = target_enterprise_id
      and wage.order_id = order_row.id
  ) wages on true
  where order_row.enterprise_id = target_enterprise_id
    and (target_status is null or order_row.status = target_status)
  order by order_row.created_at desc;
end;
$$;

create or replace function public.finance_list_wages(
  target_enterprise_id uuid,
  target_status text default null,
  target_worker_id uuid default null
)
returns table (
  id uuid,
  worker_id uuid,
  task_id uuid,
  wage_amount numeric,
  status text,
  created_at timestamptz,
  worker jsonb,
  task jsonb
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.read')
    or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.read.all') then
    raise exception 'finance wage permission denied' using errcode = '42501';
  end if;

  return query
  select
    wage.id,
    wage.worker_id,
    wage.task_id,
    wage.wage_amount,
    wage.status,
    wage.created_at,
    jsonb_build_object(
      'id', worker.id,
      'name', worker.name,
      'worker_no', worker.worker_no,
      'craft_type', worker.craft_type
    ),
    jsonb_build_object(
      'id', task.id,
      'task_no', task.task_no,
      'task_name', task.task_name,
      'process_name', task.process_name
    )
  from public.worker_wage_records wage
  join public.workers worker
    on worker.enterprise_id = wage.enterprise_id
    and worker.id = wage.worker_id
  join public.production_tasks task
    on task.enterprise_id = wage.enterprise_id
    and task.id = wage.task_id
  where wage.enterprise_id = target_enterprise_id
    and (target_status is null or wage.status = target_status)
    and (target_worker_id is null or wage.worker_id = target_worker_id)
  order by wage.created_at desc;
end;
$$;

create or replace function public.finance_list_settlements(target_enterprise_id uuid)
returns table (
  id uuid,
  worker_id uuid,
  wage_amount numeric,
  status text,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz,
  worker jsonb
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.read')
    or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.read.all') then
    raise exception 'finance wage permission denied' using errcode = '42501';
  end if;

  return query
  select
    wage.id,
    wage.worker_id,
    wage.wage_amount,
    wage.status,
    wage.approved_at,
    wage.paid_at,
    wage.created_at,
    jsonb_build_object(
      'id', worker.id,
      'name', worker.name,
      'worker_no', worker.worker_no
    )
  from public.worker_wage_records wage
  join public.workers worker
    on worker.enterprise_id = wage.enterprise_id
    and worker.id = wage.worker_id
  where wage.enterprise_id = target_enterprise_id
    and wage.status in ('settled', 'paid')
  order by wage.updated_at desc;
end;
$$;

alter function public.finance_read_order_details(uuid, uuid) owner to v2_function_owner;
alter function public.finance_list_order_item_amounts(uuid, uuid[]) owner to v2_function_owner;
alter function public.wages_read_order_task_amounts(uuid, uuid) owner to v2_function_owner;
alter function public.wages_read_employee_base_salaries(uuid) owner to v2_function_owner;

revoke all on function public.finance_read_order_details(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.finance_list_order_item_amounts(uuid, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.wages_read_order_task_amounts(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.wages_read_employee_base_salaries(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.finance_read_order_details(uuid, uuid) to authenticated;
grant execute on function public.finance_list_order_item_amounts(uuid, uuid[]) to authenticated;
grant execute on function public.wages_read_order_task_amounts(uuid, uuid) to authenticated;
grant execute on function public.wages_read_employee_base_salaries(uuid) to authenticated;

revoke create on schema public from v2_function_owner;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
