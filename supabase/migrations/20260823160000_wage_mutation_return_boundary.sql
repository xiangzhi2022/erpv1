-- Wage mutation permissions do not imply permission to read wage amounts.

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select, update on table public.worker_wage_records to v2_function_owner;
grant insert on table public.order_status_logs to v2_function_owner;

drop function public.finance_settle_wage_records(uuid, uuid[]);
drop function public.finance_pay_wage_record(uuid, uuid);
drop function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric);

create function public.finance_settle_wage_records(
  target_enterprise_id uuid,
  target_record_ids uuid[]
)
returns table (id uuid, status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_ids uuid[];
  actor_id uuid := auth.uid();
begin
  if actor_id is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.settle') then
    raise exception 'wage settlement permission denied' using errcode = '42501';
  end if;
  if coalesce(pg_catalog.cardinality(target_record_ids), 0) not between 1 and 100
    or pg_catalog.cardinality(target_record_ids) <> (
      select count(distinct record_id)
      from pg_catalog.unnest(target_record_ids) as record_id
    ) then
    raise exception 'invalid wage record ids' using errcode = '22023';
  end if;

  with updated as (
    update public.worker_wage_records as wage_record
    set status = 'settled', updated_at = now()
    where wage_record.enterprise_id = target_enterprise_id
      and wage_record.id = any(target_record_ids)
      and wage_record.status = 'approved'
    returning wage_record.id
  )
  select coalesce(pg_catalog.array_agg(updated.id), '{}'::uuid[])
  into updated_ids
  from updated;

  if pg_catalog.cardinality(updated_ids) <> pg_catalog.cardinality(target_record_ids) then
    raise exception 'wage status conflict' using errcode = 'P0001';
  end if;

  insert into public.order_status_logs (
    enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
  )
  select target_enterprise_id, 'wage_record', record_id, 'approved', 'settled', actor_id, '财务结算工资'
  from pg_catalog.unnest(updated_ids) as record_id;

  return query
  select wage_record.id, wage_record.status, wage_record.updated_at
  from public.worker_wage_records as wage_record
  where wage_record.enterprise_id = target_enterprise_id
    and wage_record.id = any(updated_ids);
end;
$$;

create function public.finance_pay_wage_record(
  target_enterprise_id uuid,
  target_record_id uuid
)
returns table (id uuid, status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_record public.worker_wage_records%rowtype;
  actor_id uuid := auth.uid();
begin
  if actor_id is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.settle') then
    raise exception 'wage settlement permission denied' using errcode = '42501';
  end if;

  update public.worker_wage_records as wage_record
  set status = 'paid', paid_at = now(), updated_at = now()
  where wage_record.enterprise_id = target_enterprise_id
    and wage_record.id = target_record_id
    and wage_record.status = 'settled'
  returning wage_record.* into updated_record;

  if not found then
    raise exception 'wage status conflict' using errcode = 'P0001';
  end if;

  insert into public.order_status_logs (
    enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
  ) values (
    target_enterprise_id, 'wage_record', target_record_id,
    'settled', 'paid', actor_id, '财务标记工资已发放'
  );

  id := updated_record.id;
  status := updated_record.status;
  updated_at := updated_record.updated_at;
  return next;
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
returns table (id uuid, status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  updated_record public.worker_wage_records%rowtype;
  actor_id uuid := auth.uid();
begin
  if actor_id is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'wages.manage') then
    raise exception 'wage management permission denied' using errcode = '42501';
  end if;
  if (target_wage_amount is not null and (
        target_wage_amount < 0
        or target_wage_amount::text in ('NaN', 'Infinity', '-Infinity')
      ))
    or (target_quantity is not null and (
        target_quantity < 0
        or target_quantity::text in ('NaN', 'Infinity', '-Infinity')
      ))
    or (target_unit_price is not null and (
        target_unit_price < 0
        or target_unit_price::text in ('NaN', 'Infinity', '-Infinity')
      )) then
    raise exception 'INVALID_WAGE_NUMERIC_VALUE' using errcode = '22023';
  end if;
  if target_expected_status = 'approved'
    and (target_wage_amount is not null or target_quantity is not null or target_unit_price is not null) then
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

  update public.worker_wage_records as wage_record
  set status = target_status,
      wage_amount = coalesce(target_wage_amount, wage_record.wage_amount),
      quantity = coalesce(target_quantity, wage_record.quantity),
      unit_price = coalesce(target_unit_price, wage_record.unit_price),
      approved_by = case
        when target_status <> 'approved' then null
        when target_expected_status <> 'approved' then actor_id
        else wage_record.approved_by
      end,
      approved_at = case
        when target_status <> 'approved' then null
        when target_expected_status <> 'approved' then now()
        else wage_record.approved_at
      end,
      updated_at = now()
  where wage_record.enterprise_id = target_enterprise_id
    and wage_record.id = target_record_id
    and wage_record.status = target_expected_status
  returning wage_record.* into updated_record;

  if not found then
    raise exception 'wage status conflict' using errcode = 'P0001';
  end if;
  if target_status <> target_expected_status then
    insert into public.order_status_logs (
      enterprise_id, target_type, target_id, from_status, to_status, changed_by, remark
    ) values (
      target_enterprise_id, 'wage_record', target_record_id,
      target_expected_status, target_status, actor_id, '工资记录状态更新'
    );
  end if;

  id := updated_record.id;
  status := updated_record.status;
  updated_at := updated_record.updated_at;
  return next;
end;
$$;

alter function public.finance_settle_wage_records(uuid, uuid[]) owner to v2_function_owner;
alter function public.finance_pay_wage_record(uuid, uuid) owner to v2_function_owner;
alter function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric)
  owner to v2_function_owner;

revoke all on function public.finance_settle_wage_records(uuid, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.finance_pay_wage_record(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric)
  from public, anon, authenticated, service_role;

grant execute on function public.finance_settle_wage_records(uuid, uuid[]) to authenticated;
grant execute on function public.finance_pay_wage_record(uuid, uuid) to authenticated;
grant execute on function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric)
  to authenticated;

revoke create on schema public from v2_function_owner;
do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_auth_members
    where roleid = 'v2_function_owner'::regrole
      and member = 'postgres'::regrole
  ) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
