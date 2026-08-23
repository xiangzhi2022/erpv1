do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;
grant create on schema public to v2_function_owner;

grant select, update on table public.orders to v2_function_owner;
grant select, update on table public.worker_wage_records to v2_function_owner;
grant select on table public.workers to v2_function_owner;
grant select on table public.production_tasks to v2_function_owner;
grant insert on table public.order_status_logs to v2_function_owner;

create function public.finance_update_order_pricing(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_total_amount numeric default null,
  target_cost_amount numeric default null,
  target_profit_amount numeric default null,
  target_deposit_amount numeric default null
)
returns setof public.orders
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_order public.orders%rowtype;
begin
  if auth.uid() is null or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'finance permission denied' using errcode = '42501';
  end if;
  if (target_total_amount is not null and (target_total_amount < 0 or target_total_amount <> trunc(target_total_amount)))
    or (target_cost_amount is not null and (target_cost_amount < 0 or target_cost_amount <> trunc(target_cost_amount)))
    or (target_deposit_amount is not null and (target_deposit_amount < 0 or target_deposit_amount <> trunc(target_deposit_amount)))
    or (target_profit_amount is not null and target_profit_amount <> trunc(target_profit_amount)) then
    raise exception 'invalid cents amount' using errcode = '22023';
  end if;

  update public.orders
  set total_amount = coalesce(target_total_amount, total_amount),
      cost_amount = coalesce(target_cost_amount, cost_amount),
      profit_amount = coalesce(target_profit_amount, profit_amount),
      deposit_amount = coalesce(target_deposit_amount, deposit_amount),
      updated_at = now()
  where enterprise_id = target_enterprise_id
    and id = target_order_id
  returning * into updated_order;

  if found then
    return next updated_order;
  end if;
end;
$$;

create function public.finance_settle_wage_records(
  target_enterprise_id uuid,
  target_record_ids uuid[]
)
returns setof public.worker_wage_records
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_ids uuid[];
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.settle') then
    raise exception 'wage settlement permission denied' using errcode = '42501';
  end if;
  if coalesce(cardinality(target_record_ids), 0) not between 1 and 100
    or cardinality(target_record_ids) <> (select count(distinct record_id) from unnest(target_record_ids) as record_id) then
    raise exception 'invalid wage record ids' using errcode = '22023';
  end if;

  with updated as (
    update public.worker_wage_records
    set status = 'settled', updated_at = now()
    where enterprise_id = target_enterprise_id
      and id = any(target_record_ids)
      and status = 'approved'
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into updated_ids from updated;

  if cardinality(updated_ids) <> cardinality(target_record_ids) then
    raise exception 'wage status conflict' using errcode = 'P0001';
  end if;

  insert into public.order_status_logs (
    enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
  )
  select target_enterprise_id, 'wage_record', record_id, 'approved', 'settled', actor_id, '财务结算工资'
  from unnest(updated_ids) as record_id;

  return query
  select * from public.worker_wage_records
  where enterprise_id = target_enterprise_id and id = any(updated_ids);
end;
$$;

create function public.finance_pay_wage_record(
  target_enterprise_id uuid,
  target_record_id uuid
)
returns setof public.worker_wage_records
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_record public.worker_wage_records%rowtype;
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.settle') then
    raise exception 'wage settlement permission denied' using errcode = '42501';
  end if;

  update public.worker_wage_records
  set status = 'paid', paid_at = now(), updated_at = now()
  where enterprise_id = target_enterprise_id
    and id = target_record_id
    and status = 'settled'
  returning * into updated_record;

  if not found then
    raise exception 'wage status conflict' using errcode = 'P0001';
  end if;

  insert into public.order_status_logs (
    enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
  ) values (
    target_enterprise_id, 'wage_record', target_record_id, 'settled', 'paid', actor_id, '财务标记工资已发放'
  );

  return next updated_record;
end;
$$;

create function public.finance_manage_wage_record(
  target_enterprise_id uuid,
  target_record_id uuid,
  target_expected_status text,
  target_status text,
  target_wage_amount numeric default null,
  target_quantity numeric default null,
  target_unit_price numeric default null
)
returns setof public.worker_wage_records
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_record public.worker_wage_records%rowtype;
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.manage') then
    raise exception 'wage management permission denied' using errcode = '42501';
  end if;
  if target_expected_status = 'approved' and (target_wage_amount is not null or target_quantity is not null or target_unit_price is not null) then
    raise exception 'approved wage cannot be edited' using errcode = '22023';
  end if;
  if target_expected_status in ('settled', 'paid')
    or target_status not in ('pending', 'approved', 'rejected')
    or not (
      target_status = target_expected_status
      or (target_expected_status = 'pending' and target_status in ('approved', 'rejected'))
      or (target_expected_status = 'rejected' and target_status in ('pending', 'approved'))
      or (target_expected_status = 'approved' and target_status = 'rejected')
    ) then
    raise exception 'wage status conflict' using errcode = 'P0001';
  end if;

  update public.worker_wage_records
  set status = target_status,
      wage_amount = coalesce(target_wage_amount, wage_amount),
      quantity = coalesce(target_quantity, quantity),
      unit_price = coalesce(target_unit_price, unit_price),
      approved_by = case when target_status <> 'approved' then null when target_expected_status <> 'approved' then actor_id else approved_by end,
      approved_at = case when target_status <> 'approved' then null when target_expected_status <> 'approved' then now() else approved_at end,
      updated_at = now()
  where enterprise_id = target_enterprise_id
    and id = target_record_id
    and status = target_expected_status
  returning * into updated_record;

  if not found then
    raise exception 'wage status conflict' using errcode = 'P0001';
  end if;

  if target_status <> target_expected_status then
    insert into public.order_status_logs (
      enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
    ) values (
      target_enterprise_id, 'wage_record', target_record_id, target_expected_status, target_status, actor_id, '工资记录状态更新'
    );
  end if;

  return next updated_record;
end;
$$;

create function public.finance_list_order_summaries(
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
begin
  if auth.uid() is null or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.read') then
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
    coalesce(wages.labor_cost, 0),
    case when order_row.cost_amount <> 0 then order_row.cost_amount else coalesce(wages.labor_cost, 0) end,
    order_row.total_amount - case when order_row.cost_amount <> 0 then order_row.cost_amount else coalesce(wages.labor_cost, 0) end,
    order_row.total_amount,
    case when order_row.cost_amount <> 0 then order_row.cost_amount else coalesce(wages.labor_cost, 0) end
  from public.orders order_row
  left join lateral (
    select coalesce(sum(wage.wage_amount), 0) as labor_cost
    from public.worker_wage_records wage
    where wage.enterprise_id = target_enterprise_id and wage.order_id = order_row.id
  ) wages on true
  where order_row.enterprise_id = target_enterprise_id
    and (target_status is null or order_row.status = target_status)
  order by order_row.created_at desc;
end;
$$;

create function public.finance_list_wages(
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
  if auth.uid() is null or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.read') then
    raise exception 'finance permission denied' using errcode = '42501';
  end if;

  return query
  select
    wage.id,
    wage.worker_id,
    wage.task_id,
    wage.wage_amount,
    wage.status,
    wage.created_at,
    jsonb_build_object('id', worker.id, 'name', worker.name, 'worker_no', worker.worker_no, 'craft_type', worker.craft_type),
    jsonb_build_object('id', task.id, 'task_no', task.task_no, 'task_name', task.task_name, 'process_name', task.process_name)
  from public.worker_wage_records wage
  join public.workers worker on worker.enterprise_id = wage.enterprise_id and worker.id = wage.worker_id
  join public.production_tasks task on task.enterprise_id = wage.enterprise_id and task.id = wage.task_id
  where wage.enterprise_id = target_enterprise_id
    and (target_status is null or wage.status = target_status)
    and (target_worker_id is null or wage.worker_id = target_worker_id)
  order by wage.created_at desc;
end;
$$;

create function public.finance_list_settlements(target_enterprise_id uuid)
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
  if auth.uid() is null or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.read') then
    raise exception 'finance permission denied' using errcode = '42501';
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
    jsonb_build_object('id', worker.id, 'name', worker.name, 'worker_no', worker.worker_no)
  from public.worker_wage_records wage
  join public.workers worker on worker.enterprise_id = wage.enterprise_id and worker.id = wage.worker_id
  where wage.enterprise_id = target_enterprise_id
    and wage.status in ('settled', 'paid')
  order by wage.updated_at desc;
end;
$$;

alter function public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric) owner to v2_function_owner;
alter function public.finance_settle_wage_records(uuid, uuid[]) owner to v2_function_owner;
alter function public.finance_pay_wage_record(uuid, uuid) owner to v2_function_owner;
alter function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric) owner to v2_function_owner;
alter function public.finance_list_order_summaries(uuid, text) owner to v2_function_owner;
alter function public.finance_list_wages(uuid, text, uuid) owner to v2_function_owner;
alter function public.finance_list_settlements(uuid) owner to v2_function_owner;

revoke all on function public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric) from public, anon, authenticated, service_role;
revoke all on function public.finance_settle_wage_records(uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.finance_pay_wage_record(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric) from public, anon, authenticated, service_role;
revoke all on function public.finance_list_order_summaries(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.finance_list_wages(uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finance_list_settlements(uuid) from public, anon, authenticated, service_role;

grant execute on function public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.finance_settle_wage_records(uuid, uuid[]) to authenticated;
grant execute on function public.finance_pay_wage_record(uuid, uuid) to authenticated;
grant execute on function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric) to authenticated;
grant execute on function public.finance_list_order_summaries(uuid, text) to authenticated;
grant execute on function public.finance_list_wages(uuid, text, uuid) to authenticated;
grant execute on function public.finance_list_settlements(uuid) to authenticated;

revoke create on schema public from v2_function_owner;
do $$
begin
  if exists (
    select 1
    from pg_auth_members membership
    join pg_roles role on role.oid = membership.roleid
    join pg_roles member on member.oid = membership.member
    where role.rolname = 'v2_function_owner' and member.rolname = 'postgres'
  ) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
