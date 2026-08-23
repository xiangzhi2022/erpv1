-- Mutating an exchange must not implicitly grant access to its message or
-- proposed changes. Return only the acknowledgement needed by API callers.

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;

drop function public.transition_order_exchange(uuid, text, text, jsonb);

create function public.transition_order_exchange(
  target_exchange_id uuid,
  target_action text,
  target_message text default null,
  target_proposed_changes jsonb default null
)
returns table (id uuid, status text, updated_at timestamptz)
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

  select exchange_row.*
  into existing_exchange
  from public.order_exchanges as exchange_row
  where exchange_row.id = target_exchange_id
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

  update public.order_exchanges as exchange_row
  set status = next_status,
      message = next_message,
      proposed_changes = next_proposed_changes,
      handled_by = actor_id,
      handled_at = now(),
      updated_at = now()
  where exchange_row.id = target_exchange_id
    and exchange_row.status = existing_exchange.status
  returning exchange_row.* into updated_exchange;
  if not found then
    raise exception 'ORDER_EXCHANGE_STATUS_CONFLICT' using errcode = 'P0001';
  end if;

  id := updated_exchange.id;
  status := updated_exchange.status;
  updated_at := updated_exchange.updated_at;
  return next;
end;
$$;

alter function public.transition_order_exchange(uuid, text, text, jsonb)
  owner to v2_function_owner;

revoke all on function public.transition_order_exchange(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.transition_order_exchange(uuid, text, text, jsonb)
  to authenticated;

revoke create on schema public from v2_function_owner;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_auth_members membership
    join pg_catalog.pg_roles role on role.oid = membership.roleid
    join pg_catalog.pg_roles member on member.oid = membership.member
    where role.rolname = 'v2_function_owner'
      and member.rolname = 'postgres'
  ) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
