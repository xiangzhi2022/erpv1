-- Component structure deletion is a workflow mutation, not generic table DML.
-- Revoke direct deletion and serialize the guarded operation with its parent order.

revoke delete on table public.order_spaces from authenticated;
revoke delete on table public.order_modules from authenticated;
revoke delete on table public.order_items from authenticated;
revoke delete on table public.order_products from authenticated;

drop policy if exists order_spaces_delete on public.order_spaces;
drop policy if exists order_modules_delete on public.order_modules;
drop policy if exists order_items_delete on public.order_items;
drop policy if exists order_products_delete on public.order_products;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;
grant select on table
  public.orders,
  public.order_spaces,
  public.order_modules,
  public.order_items,
  public.order_products
to v2_function_owner;
grant delete on table
  public.order_spaces,
  public.order_modules,
  public.order_items,
  public.order_products
to v2_function_owner;
grant insert on table public.order_status_logs to v2_function_owner;

create function public.delete_order_component(
  target_enterprise_id uuid,
  target_type text,
  target_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := auth.uid();
  component_order_id uuid;
  locked_component_order_id uuid;
  component_status text;
  order_status text;
  deleted_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '28000', message = 'IDENTITY_REQUIRED';
  end if;
  if target_type is null or target_type not in ('space', 'module', 'item', 'product') then
    raise exception using errcode = '22023', message = 'ORDER_COMPONENT_TYPE_INVALID';
  end if;
  if not app_private.has_enterprise_permission(target_enterprise_id, 'orders.update') then
    raise exception using errcode = '42501', message = 'ORDER_COMPONENT_DELETE_FORBIDDEN';
  end if;

  -- Resolve the parent first, then lock parent -> component consistently with
  -- whole-tree mutations. The component is re-read under lock below.
  if target_type = 'space' then
    select component.order_id into component_order_id
    from public.order_spaces component
    where component.enterprise_id = target_enterprise_id and component.id = target_id;
  elsif target_type = 'module' then
    select component.order_id into component_order_id
    from public.order_modules component
    where component.enterprise_id = target_enterprise_id and component.id = target_id;
  elsif target_type = 'item' then
    select component.order_id into component_order_id
    from public.order_items component
    where component.enterprise_id = target_enterprise_id and component.id = target_id;
  else
    select component.order_id into component_order_id
    from public.order_products component
    where component.enterprise_id = target_enterprise_id and component.id = target_id;
  end if;
  if component_order_id is null then
    raise exception using errcode = 'P0002', message = 'ORDER_COMPONENT_NOT_FOUND';
  end if;

  select parent_order.status
  into order_status
  from public.orders parent_order
  where parent_order.enterprise_id = target_enterprise_id
    and parent_order.id = component_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if order_status not in ('draft', 'pending', 'returned', 'rejected') then
    raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_DELETE_STATUS_CONFLICT';
  end if;

  if target_type = 'space' then
    select component.order_id, component.status
    into locked_component_order_id, component_status
    from public.order_spaces component
    where component.enterprise_id = target_enterprise_id
      and component.id = target_id
      and component.order_id = component_order_id
    for update;
  elsif target_type = 'module' then
    select component.order_id, null::text
    into locked_component_order_id, component_status
    from public.order_modules component
    where component.enterprise_id = target_enterprise_id
      and component.id = target_id
      and component.order_id = component_order_id
    for update;
  elsif target_type = 'item' then
    select component.order_id, null::text
    into locked_component_order_id, component_status
    from public.order_items component
    where component.enterprise_id = target_enterprise_id
      and component.id = target_id
      and component.order_id = component_order_id
    for update;
  else
    select component.order_id, component.status
    into locked_component_order_id, component_status
    from public.order_products component
    where component.enterprise_id = target_enterprise_id
      and component.id = target_id
      and component.order_id = component_order_id
    for update;
  end if;
  if locked_component_order_id is null then
    raise exception using errcode = 'P0002', message = 'ORDER_COMPONENT_NOT_FOUND';
  end if;
  if target_type in ('space', 'product')
    and component_status not in ('draft', 'pending', 'returned', 'rejected') then
    raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_DELETE_STATUS_CONFLICT';
  end if;
  if target_type = 'space' then
    perform 1
    from public.order_products descendant
    where descendant.enterprise_id = target_enterprise_id
      and descendant.space_id = target_id
    for update;
    if exists (
      select 1
      from public.order_products descendant
      where descendant.enterprise_id = target_enterprise_id
        and descendant.space_id = target_id
        and descendant.status not in ('draft', 'pending', 'returned', 'rejected')
    ) then
      raise exception using errcode = 'P0001', message = 'ORDER_COMPONENT_DELETE_STATUS_CONFLICT';
    end if;
  end if;

  begin
    if target_type = 'space' then
      delete from public.order_spaces component
      where component.enterprise_id = target_enterprise_id and component.id = target_id;
    elsif target_type = 'module' then
      delete from public.order_modules component
      where component.enterprise_id = target_enterprise_id and component.id = target_id;
    elsif target_type = 'item' then
      delete from public.order_items component
      where component.enterprise_id = target_enterprise_id and component.id = target_id;
    else
      delete from public.order_products component
      where component.enterprise_id = target_enterprise_id and component.id = target_id;
    end if;
    get diagnostics deleted_count = row_count;
  exception
    when foreign_key_violation then
      raise exception using
        errcode = 'P0001',
        message = 'ORDER_COMPONENT_DELETE_DEPENDENCY_CONFLICT';
  end;

  if deleted_count <> 1 then
    raise exception using errcode = 'P0002', message = 'ORDER_COMPONENT_NOT_FOUND';
  end if;

  insert into public.order_status_logs (
    enterprise_id,
    target_type,
    target_id,
    from_status,
    to_status,
    changed_by,
    remark
  ) values (
    target_enterprise_id,
    target_type,
    target_id,
    coalesce(component_status, order_status),
    'deleted',
    actor_id,
    'Delete order component from editable order'
  );

  return jsonb_build_object(
    'id', target_id,
    'type', target_type,
    'order_id', component_order_id
  );
end;
$$;

alter function public.delete_order_component(uuid, text, uuid) owner to v2_function_owner;
revoke all on function public.delete_order_component(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_order_component(uuid, text, uuid) to authenticated;

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
