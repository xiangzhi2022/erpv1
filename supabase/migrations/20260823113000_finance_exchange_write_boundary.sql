-- Close direct PostgREST write paths that bypass finance and exchange workflows.

revoke update on table public.orders from authenticated;
grant update (
  order_no,
  customer_name,
  customer_phone,
  customer_address,
  order_source,
  status,
  target_factory_id,
  dealer_id,
  order_flow,
  from_enterprise_id,
  to_enterprise_id,
  parent_order_id,
  delivery_date,
  remark,
  internal_remark,
  updated_at
) on table public.orders to authenticated;

drop policy if exists worker_wage_records_insert on public.worker_wage_records;
drop policy if exists worker_wage_records_update on public.worker_wage_records;
drop policy if exists worker_wage_records_delete on public.worker_wage_records;

revoke update on table public.worker_wage_records from authenticated;
revoke insert, delete on table public.worker_wage_records from authenticated;

grant insert (
  enterprise_id,
  worker_id,
  order_id,
  space_id,
  product_id,
  task_id,
  wage_rule_id,
  quantity,
  unit_price,
  wage_amount,
  status,
  submitted_at,
  approved_by,
  approved_at,
  paid_at,
  created_at,
  updated_at
) on table public.worker_wage_records to authenticated;

grant update (
  worker_id,
  order_id,
  space_id,
  product_id,
  task_id,
  wage_rule_id,
  quantity,
  unit_price,
  wage_amount,
  submitted_at,
  updated_at
) on table public.worker_wage_records to authenticated;

create policy worker_wage_records_insert_pending
on public.worker_wage_records
for insert
to authenticated
with check (
  app_private.has_permission(enterprise_id, 'wages.manage')
  and status = 'pending'
  and approved_by is null
  and approved_at is null
  and paid_at is null
);

create policy worker_wage_records_update_pending
on public.worker_wage_records
for update
to authenticated
using (
  status = 'pending'
  and app_private.has_permission(enterprise_id, 'wages.manage')
)
with check (
  status = 'pending'
  and approved_by is null
  and approved_at is null
  and paid_at is null
  and app_private.has_permission(enterprise_id, 'wages.manage')
);

drop policy if exists order_exchanges_select on public.order_exchanges;
drop policy if exists order_exchanges_insert on public.order_exchanges;
drop policy if exists order_exchanges_update on public.order_exchanges;
drop policy if exists order_exchanges_delete on public.order_exchanges;
drop policy if exists order_exchanges_participant_select on public.order_exchanges;
drop policy if exists order_exchanges_participant_insert on public.order_exchanges;
drop policy if exists order_exchanges_participant_update on public.order_exchanges;

revoke insert, update, delete on table public.order_exchanges from authenticated;

create policy order_exchanges_participant_select
on public.order_exchanges
for select
to authenticated
using (
  app_private.has_permission(from_enterprise_id, 'orders.read')
  or app_private.has_permission(to_enterprise_id, 'orders.read')
);

alter table public.order_exchanges
  drop constraint if exists order_exchanges_status_check;

alter table public.order_exchanges
  add constraint order_exchanges_status_check
  check (status in (
    'draft',
    'sent',
    'change_requested',
    'accepted',
    'completed',
    'returned',
    'rejected',
    'withdrawn'
  )) not valid;

alter table public.order_exchanges
  validate constraint order_exchanges_status_check;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select on table public.enterprises, public.orders to v2_function_owner;
grant select, insert, update on table public.order_exchanges to v2_function_owner;

create function public.create_order_exchange(
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
    or not app_private.has_permission(target_from_enterprise_id, 'orders.submit') then
    raise exception 'ORDER_EXCHANGE_SUBMIT_FORBIDDEN' using errcode = '42501';
  end if;
  if target_from_enterprise_id = target_to_enterprise_id then
    raise exception 'ORDER_EXCHANGE_PARTICIPANTS_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.orders order_row
    where order_row.enterprise_id = target_from_enterprise_id
      and order_row.id = target_order_id
  ) then
    raise exception 'ORDER_EXCHANGE_ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not exists (
    select 1
    from public.enterprises enterprise_row
    where enterprise_row.id = target_to_enterprise_id
      and enterprise_row.status = 'active'
  ) then
    raise exception 'ORDER_EXCHANGE_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.order_exchanges (
    enterprise_id,
    order_id,
    from_enterprise_id,
    to_enterprise_id,
    from_user_id,
    status,
    message,
    proposed_changes
  ) values (
    target_from_enterprise_id,
    target_order_id,
    target_from_enterprise_id,
    target_to_enterprise_id,
    actor_id,
    'sent',
    target_message,
    target_proposed_changes
  )
  returning * into created_exchange;

  return next created_exchange;
end;
$$;

create function public.transition_order_exchange(
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

  select *
  into existing_exchange
  from public.order_exchanges
  where id = target_exchange_id
  for update;

  if not found then
    raise exception 'ORDER_EXCHANGE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if target_action in ('send', 'withdraw') then
    if not app_private.has_permission(existing_exchange.from_enterprise_id, 'orders.update') then
      raise exception 'ORDER_EXCHANGE_UPDATE_FORBIDDEN' using errcode = '42501';
    end if;
  elsif target_action in ('accept', 'request_change', 'reject') then
    if not app_private.has_permission(existing_exchange.to_enterprise_id, 'orders.accept') then
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
    when target_action = 'withdraw'
      and existing_exchange.status in ('draft', 'sent', 'change_requested', 'accepted') then 'withdrawn'
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

alter function public.create_order_exchange(uuid, uuid, uuid, text, jsonb)
  owner to v2_function_owner;
alter function public.transition_order_exchange(uuid, text, text, jsonb)
  owner to v2_function_owner;

revoke all on function public.create_order_exchange(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.transition_order_exchange(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.create_order_exchange(uuid, uuid, uuid, text, jsonb)
  to authenticated;
grant execute on function public.transition_order_exchange(uuid, text, text, jsonb)
  to authenticated;

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
