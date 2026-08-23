-- Serialize exchange creation on the order and keep exchanges bound to the
-- recipient selected by the order workflow.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;

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
  source_order public.orders%rowtype;
  created_exchange public.order_exchanges%rowtype;
begin
  if actor_id is null
    or not app_private.has_enterprise_permission(target_from_enterprise_id, 'orders.submit') then
    raise exception 'ORDER_EXCHANGE_SUBMIT_FORBIDDEN' using errcode = '42501';
  end if;
  if target_from_enterprise_id = target_to_enterprise_id then
    raise exception 'ORDER_EXCHANGE_PARTICIPANTS_INVALID' using errcode = '22023';
  end if;

  select *
  into source_order
  from public.orders order_row
  where order_row.enterprise_id = target_from_enterprise_id
    and order_row.id = target_order_id
  for update;
  if not found then
    raise exception 'ORDER_EXCHANGE_ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if source_order.status <> 'pending' then
    raise exception 'ORDER_EXCHANGE_ORDER_STATUS_CONFLICT' using errcode = 'P0001';
  end if;

  if source_order.from_enterprise_id is distinct from target_from_enterprise_id
    or source_order.to_enterprise_id is distinct from target_to_enterprise_id
    or source_order.order_flow is null
    or source_order.order_flow not in ('dealer_to_factory', 'factory_to_supplier')
    or (
      source_order.order_flow = 'dealer_to_factory'
      and source_order.target_factory_id is distinct from target_to_enterprise_id
    )
    or (
      source_order.order_flow = 'factory_to_supplier'
      and source_order.target_factory_id is distinct from target_from_enterprise_id
    ) then
    raise exception 'ORDER_EXCHANGE_TARGET_MISMATCH' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.enterprises enterprise_row
    where enterprise_row.id = target_to_enterprise_id
      and enterprise_row.status = 'active'
  ) then
    raise exception 'ORDER_EXCHANGE_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.order_exchanges existing_exchange
    where existing_exchange.order_id = target_order_id
      and existing_exchange.status in ('draft', 'sent', 'change_requested', 'accepted')
  ) then
    raise exception 'ORDER_EXCHANGE_ACTIVE_EXISTS' using errcode = 'P0001';
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

-- order_exchanges.order_id is constrained to the sender-owned order. Receiver
-- acceptance therefore remains on transition_order_exchange; there is no legal
-- receiver-owned order row that this wrapper could synchronize by the same id.
create or replace function public.transition_order_status_with_exchanges(
  target_enterprise_id uuid,
  target_order_id uuid,
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
  status_result jsonb;
  exchange_row record;
begin
  select pg_catalog.to_jsonb(updated_order)
  into status_result
  from public.transition_order_status(
    target_enterprise_id,
    target_order_id,
    target_expected_status,
    target_status,
    target_remark
  ) updated_order;

  if target_status = 'cancelled' then
    for exchange_row in
      select exchange.id, exchange.from_enterprise_id = target_enterprise_id as is_sender
      from public.order_exchanges exchange
      where exchange.enterprise_id = target_enterprise_id
        and exchange.order_id = target_order_id
        and (
          (
            exchange.from_enterprise_id = target_enterprise_id
            and exchange.status in ('draft', 'sent', 'change_requested', 'accepted')
          )
          or (
            exchange.to_enterprise_id = target_enterprise_id
            and exchange.from_enterprise_id <> target_enterprise_id
            and exchange.status in ('sent', 'change_requested')
          )
        )
      order by exchange.id
    loop
      perform public.transition_order_exchange(
        exchange_row.id,
        case when exchange_row.is_sender then 'withdraw' else 'reject' end,
        target_remark,
        null
      );
    end loop;
  end if;

  return status_result;
end;
$$;

alter function public.create_order_exchange(uuid, uuid, uuid, text, jsonb)
  owner to v2_function_owner;
alter function public.transition_order_status_with_exchanges(uuid, uuid, text, text, text)
  owner to v2_function_owner;

revoke all on function public.create_order_exchange(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.transition_order_status_with_exchanges(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.create_order_exchange(uuid, uuid, uuid, text, jsonb)
  to authenticated;
grant execute on function public.transition_order_status_with_exchanges(uuid, uuid, text, text, text)
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
