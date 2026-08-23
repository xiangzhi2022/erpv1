-- Keep order status and its exchange-side effects in the same database transaction.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select on table public.order_exchanges to v2_function_owner;

create function public.transition_order_exchanges_for_order(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_action text,
  target_message text default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  exchange_row record;
  transitioned_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'ORDER_EXCHANGE_AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_action not in ('accept', 'reject', 'withdraw') then
    raise exception 'ORDER_EXCHANGE_ACTION_INVALID' using errcode = '22023';
  end if;

  for exchange_row in
    select exchange.id
    from public.order_exchanges exchange
    where exchange.enterprise_id = target_enterprise_id
      and exchange.order_id = target_order_id
      and (
        (
          target_action = 'withdraw'
          and exchange.from_enterprise_id = target_enterprise_id
          and exchange.status in ('draft', 'sent', 'change_requested', 'accepted')
        )
        or (
          target_action in ('accept', 'reject')
          and exchange.to_enterprise_id = target_enterprise_id
          and exchange.status in ('sent', 'change_requested')
        )
      )
    order by exchange.id
  loop
    perform public.transition_order_exchange(
      exchange_row.id,
      target_action,
      target_message,
      null
    );
    transitioned_count := transitioned_count + 1;
  end loop;

  if transitioned_count = 0 then
    raise exception 'ORDER_EXCHANGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  return transitioned_count;
end;
$$;

create function public.transition_order_status_with_exchanges(
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

  if target_status in ('accepted', 'reviewed') then
    for exchange_row in
      select exchange.id
      from public.order_exchanges exchange
      where exchange.enterprise_id = target_enterprise_id
        and exchange.order_id = target_order_id
        and exchange.to_enterprise_id = target_enterprise_id
        and exchange.status in ('sent', 'change_requested')
      order by exchange.id
    loop
      perform public.transition_order_exchange(exchange_row.id, 'accept', null, null);
    end loop;
  elsif target_status = 'cancelled' then
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

alter function public.transition_order_exchanges_for_order(uuid, uuid, text, text)
  owner to v2_function_owner;
alter function public.transition_order_status_with_exchanges(uuid, uuid, text, text, text)
  owner to v2_function_owner;

revoke all on function public.transition_order_exchanges_for_order(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.transition_order_status_with_exchanges(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.transition_order_exchanges_for_order(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.transition_order_status_with_exchanges(uuid, uuid, text, text, text)
  to authenticated;

revoke create on schema public from v2_function_owner;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
