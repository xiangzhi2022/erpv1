-- Forward-fix enterprise-wide finance, wage, and exchange boundaries.
-- Earlier migrations used scope-aware permission checks for objects that have no
-- site/workshop scope. Replacing the functions here also protects databases that
-- already recorded those earlier migration versions.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;

revoke insert, update, delete on table public.worker_wage_records from authenticated;
drop policy if exists worker_wage_records_insert_pending on public.worker_wage_records;
drop policy if exists worker_wage_records_update_pending on public.worker_wage_records;

create or replace function public.finance_update_order_pricing(
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

  if found then return next updated_order; end if;
end;
$$;

create or replace function public.finance_settle_wage_records(
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

create or replace function public.finance_pay_wage_record(
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

create or replace function public.finance_manage_wage_record(
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

create or replace function public.create_order_exchange(
  target_from_enterprise_id uuid,
  target_order_id uuid,
  target_to_enterprise_id uuid,
  target_message text default null,
  target_proposed_changes jsonb default null
)
returns setof public.order_exchanges
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  created_exchange public.order_exchanges%rowtype;
begin
  if actor_id is null
    or not app_private.has_enterprise_permission(target_from_enterprise_id, 'orders.submit') then
    raise exception 'ORDER_EXCHANGE_SUBMIT_FORBIDDEN' using errcode = '42501';
  end if;
  if target_from_enterprise_id = target_to_enterprise_id then
    raise exception 'ORDER_EXCHANGE_PARTICIPANTS_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.orders order_row
    where order_row.enterprise_id = target_from_enterprise_id
      and order_row.id = target_order_id
  ) then
    raise exception 'ORDER_EXCHANGE_ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.enterprises enterprise_row
    where enterprise_row.id = target_to_enterprise_id
      and enterprise_row.status = 'active'
  ) then
    raise exception 'ORDER_EXCHANGE_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.order_exchanges (
    enterprise_id, order_id, from_enterprise_id, to_enterprise_id,
    from_user_id, status, message, proposed_changes
  ) values (
    target_from_enterprise_id, target_order_id, target_from_enterprise_id,
    target_to_enterprise_id, actor_id, 'sent', target_message, target_proposed_changes
  ) returning * into created_exchange;
  return next created_exchange;
end;
$$;

create or replace function public.transition_order_exchange(
  target_exchange_id uuid,
  target_action text,
  target_message text default null,
  target_proposed_changes jsonb default null
)
returns setof public.order_exchanges
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  existing_exchange public.order_exchanges%rowtype;
  updated_exchange public.order_exchanges%rowtype;
  next_status text;
  next_message text;
  next_proposed_changes jsonb;
begin
  if actor_id is null then
    raise exception 'ORDER_EXCHANGE_AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into existing_exchange
  from public.order_exchanges
  where id = target_exchange_id
  for update;
  if not found then
    raise exception 'ORDER_EXCHANGE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if target_action in ('send', 'withdraw') then
    if not app_private.has_enterprise_permission(existing_exchange.from_enterprise_id, 'orders.update') then
      raise exception 'ORDER_EXCHANGE_UPDATE_FORBIDDEN' using errcode = '42501';
    end if;
  elsif target_action in ('accept', 'request_change', 'reject') then
    if not app_private.has_enterprise_permission(existing_exchange.to_enterprise_id, 'orders.accept') then
      raise exception 'ORDER_EXCHANGE_ACCEPT_FORBIDDEN' using errcode = '42501';
    end if;
  else
    raise exception 'ORDER_EXCHANGE_ACTION_INVALID' using errcode = '22023';
  end if;

  next_status := case
    when target_action = 'send' and existing_exchange.status = 'draft' then 'sent'
    when target_action = 'accept' and existing_exchange.status in ('sent', 'change_requested') then 'accepted'
    when target_action = 'request_change' and existing_exchange.status = 'sent' then 'change_requested'
    when target_action = 'reject' and existing_exchange.status in ('sent', 'change_requested') then 'rejected'
    when target_action = 'withdraw' and existing_exchange.status in ('draft', 'sent', 'change_requested', 'accepted') then 'withdrawn'
    else null
  end;
  if next_status is null then
    raise exception 'ORDER_EXCHANGE_STATUS_CONFLICT' using errcode = 'P0001';
  end if;

  next_message := existing_exchange.message;
  if target_message is not null then
    if target_action = 'withdraw' and existing_exchange.message is not null then
      next_message := existing_exchange.message || E'\n撤回原因：' || target_message;
    elsif target_action = 'withdraw' then
      next_message := '撤回原因：' || target_message;
    else
      next_message := target_message;
    end if;
  end if;
  next_proposed_changes := case
    when target_action = 'request_change' then target_proposed_changes
    else existing_exchange.proposed_changes
  end;

  update public.order_exchanges
  set status = next_status,
      message = next_message,
      proposed_changes = next_proposed_changes,
      handled_by = actor_id,
      handled_at = now(),
      updated_at = now()
  where id = target_exchange_id
    and status = existing_exchange.status
  returning * into updated_exchange;
  if not found then
    raise exception 'ORDER_EXCHANGE_STATUS_CONFLICT' using errcode = 'P0001';
  end if;
  return next updated_exchange;
end;
$$;

alter function public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric)
  owner to v2_function_owner;
alter function public.finance_settle_wage_records(uuid, uuid[]) owner to v2_function_owner;
alter function public.finance_pay_wage_record(uuid, uuid) owner to v2_function_owner;
alter function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric)
  owner to v2_function_owner;
alter function public.create_order_exchange(uuid, uuid, uuid, text, jsonb) owner to v2_function_owner;
alter function public.transition_order_exchange(uuid, text, text, jsonb) owner to v2_function_owner;

revoke all on function public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.finance_settle_wage_records(uuid, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.finance_pay_wage_record(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.create_order_exchange(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.transition_order_exchange(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric)
  to authenticated;
grant execute on function public.finance_settle_wage_records(uuid, uuid[]) to authenticated;
grant execute on function public.finance_pay_wage_record(uuid, uuid) to authenticated;
grant execute on function public.finance_manage_wage_record(uuid, uuid, text, text, numeric, numeric, numeric)
  to authenticated;
grant execute on function public.create_order_exchange(uuid, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.transition_order_exchange(uuid, text, text, jsonb) to authenticated;

revoke create on schema public from v2_function_owner;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
