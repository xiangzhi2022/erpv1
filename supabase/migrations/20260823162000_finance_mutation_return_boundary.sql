-- Finance mutation permission grants the ability to change sensitive values,
-- but finance.read is a separate capability. Keep mutation acknowledgements
-- free of table rows so a write-only caller cannot use NULL inputs as a read.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;

drop function if exists public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric);
drop function if exists public.finance_update_order_product(uuid, uuid, numeric, numeric, numeric, text, boolean);
drop function if exists public.finance_update_order_item_pricing(uuid, uuid, numeric, numeric);
drop function if exists public.update_order_internal_remark(uuid, uuid, text);

create function public.finance_update_order_pricing(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_total_amount numeric default null,
  target_cost_amount numeric default null,
  target_profit_amount numeric default null,
  target_deposit_amount numeric default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'finance permission denied' using errcode = '42501';
  end if;
  if (target_total_amount is not null and (
      target_total_amount < 0 or target_total_amount <> trunc(target_total_amount)
      or target_total_amount::text in ('NaN', 'Infinity', '-Infinity')
    ))
    or (target_cost_amount is not null and (
      target_cost_amount < 0 or target_cost_amount <> trunc(target_cost_amount)
      or target_cost_amount::text in ('NaN', 'Infinity', '-Infinity')
    ))
    or (target_deposit_amount is not null and (
      target_deposit_amount < 0 or target_deposit_amount <> trunc(target_deposit_amount)
      or target_deposit_amount::text in ('NaN', 'Infinity', '-Infinity')
    ))
    or (target_profit_amount is not null and (
      target_profit_amount <> trunc(target_profit_amount)
      or target_profit_amount::text in ('NaN', 'Infinity', '-Infinity')
    )) then
    raise exception 'invalid cents amount' using errcode = '22023';
  end if;

  update public.orders as order_record
  set total_amount = coalesce(target_total_amount, order_record.total_amount),
      cost_amount = coalesce(target_cost_amount, order_record.cost_amount),
      profit_amount = coalesce(target_profit_amount, order_record.profit_amount),
      deposit_amount = coalesce(target_deposit_amount, order_record.deposit_amount),
      updated_at = now()
  where order_record.enterprise_id = target_enterprise_id
    and order_record.id = target_order_id
  returning order_record.id into id;

  if found then
    return next;
  end if;
end;
$$;

create function public.finance_update_order_product(
  target_enterprise_id uuid,
  target_product_id uuid,
  target_quoted_amount numeric default null,
  target_cost_amount numeric default null,
  target_profit_amount numeric default null,
  target_internal_remark text default null,
  update_internal_remark boolean default false
)
returns table (id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'ORDER_PRODUCT_FINANCE_FORBIDDEN' using errcode = '42501';
  end if;
  if (target_quoted_amount is not null and (
      target_quoted_amount < 0 or target_quoted_amount <> trunc(target_quoted_amount)
      or target_quoted_amount::text in ('NaN', 'Infinity', '-Infinity')
    ))
    or (target_cost_amount is not null and (
      target_cost_amount < 0 or target_cost_amount <> trunc(target_cost_amount)
      or target_cost_amount::text in ('NaN', 'Infinity', '-Infinity')
    ))
    or (target_profit_amount is not null and (
      target_profit_amount <> trunc(target_profit_amount)
      or target_profit_amount::text in ('NaN', 'Infinity', '-Infinity')
    )) then
    raise exception 'INVALID_CENTS_AMOUNT' using errcode = '22023';
  end if;

  update public.order_products as product_record
  set quoted_amount = coalesce(target_quoted_amount, product_record.quoted_amount),
      cost_amount = coalesce(target_cost_amount, product_record.cost_amount),
      profit_amount = coalesce(target_profit_amount, product_record.profit_amount),
      internal_remark = case
        when update_internal_remark then target_internal_remark
        else product_record.internal_remark
      end,
      updated_at = now()
  where product_record.enterprise_id = target_enterprise_id
    and product_record.id = target_product_id
  returning product_record.id into id;

  if not found then
    raise exception 'ORDER_PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;
  return next;
end;
$$;

create function public.finance_update_order_item_pricing(
  target_enterprise_id uuid,
  target_order_item_id uuid,
  target_unit_price numeric default null,
  target_subtotal numeric default null
)
returns table (id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'ORDER_ITEM_FINANCE_FORBIDDEN' using errcode = '42501';
  end if;
  if (target_unit_price is not null and (
      target_unit_price < 0 or target_unit_price <> trunc(target_unit_price)
      or target_unit_price::text in ('NaN', 'Infinity', '-Infinity')
    ))
    or (target_subtotal is not null and (
      target_subtotal < 0 or target_subtotal <> trunc(target_subtotal)
      or target_subtotal::text in ('NaN', 'Infinity', '-Infinity')
    )) then
    raise exception 'INVALID_CENTS_AMOUNT' using errcode = '22023';
  end if;

  update public.order_items as item_record
  set unit_price = coalesce(target_unit_price, item_record.unit_price),
      subtotal = coalesce(target_subtotal, item_record.subtotal),
      updated_at = now()
  where item_record.enterprise_id = target_enterprise_id
    and item_record.id = target_order_item_id
  returning item_record.id into id;

  if not found then
    raise exception 'ORDER_ITEM_NOT_FOUND' using errcode = 'P0002';
  end if;
  return next;
end;
$$;

create function public.update_order_internal_remark(
  target_enterprise_id uuid,
  target_order_id uuid,
  target_internal_remark text
)
returns table (id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or not app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage') then
    raise exception 'ORDER_INTERNAL_REMARK_FORBIDDEN' using errcode = '42501';
  end if;

  update public.orders as order_record
  set internal_remark = target_internal_remark,
      updated_at = now()
  where order_record.enterprise_id = target_enterprise_id
    and order_record.id = target_order_id
  returning order_record.id into id;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return next;
end;
$$;

alter function public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric)
  owner to v2_function_owner;
alter function public.finance_update_order_product(uuid, uuid, numeric, numeric, numeric, text, boolean)
  owner to v2_function_owner;
alter function public.finance_update_order_item_pricing(uuid, uuid, numeric, numeric)
  owner to v2_function_owner;
alter function public.update_order_internal_remark(uuid, uuid, text)
  owner to v2_function_owner;

revoke all on function public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.finance_update_order_product(uuid, uuid, numeric, numeric, numeric, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.finance_update_order_item_pricing(uuid, uuid, numeric, numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.update_order_internal_remark(uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric)
  to authenticated;
grant execute on function public.finance_update_order_product(uuid, uuid, numeric, numeric, numeric, text, boolean)
  to authenticated;
grant execute on function public.finance_update_order_item_pricing(uuid, uuid, numeric, numeric)
  to authenticated;
grant execute on function public.update_order_internal_remark(uuid, uuid, text)
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
