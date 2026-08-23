-- Parent order references form a workflow graph, not an arbitrary self-FK.
-- Enforce the graph invariants for every writer, including privileged RPCs.

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant select on table public.orders to v2_function_owner;

create function app_private.enforce_order_parent_graph()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  parent_order public.orders%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.enterprise_id::text, 0)
  );

  if TG_OP = 'UPDATE'
    and (
      OLD.order_flow is distinct from NEW.order_flow
      or OLD.to_enterprise_id is distinct from NEW.to_enterprise_id
      or OLD.enterprise_id is distinct from NEW.enterprise_id
    )
    and exists (
      select 1
      from public.orders as child
      where child.enterprise_id = OLD.enterprise_id
        and child.parent_order_id = OLD.id
        and child.order_flow = 'factory_to_supplier'
        and (
          NEW.enterprise_id is distinct from child.enterprise_id
          or NEW.order_flow <> 'dealer_to_factory'
          or NEW.to_enterprise_id is distinct from child.enterprise_id
        )
    ) then
    raise exception using errcode = '23514', message = 'ORDER_PARENT_CHILD_FLOW_INVALID';
  end if;

  if NEW.parent_order_id is null then
    return NEW;
  end if;
  if NEW.parent_order_id = NEW.id then
    raise exception using errcode = '23514', message = 'ORDER_PARENT_SELF_REFERENCE';
  end if;

  select parent.*
  into parent_order
  from public.orders as parent
  where parent.enterprise_id = NEW.enterprise_id
    and parent.id = NEW.parent_order_id
  for key share;
  if not found then
    raise exception using errcode = '23503', message = 'ORDER_PARENT_NOT_FOUND';
  end if;

  if NEW.order_flow = 'factory_to_supplier'
    and (
      parent_order.order_flow <> 'dealer_to_factory'
      or parent_order.to_enterprise_id is distinct from NEW.enterprise_id
    ) then
    raise exception using errcode = '23514', message = 'ORDER_PARENT_FLOW_INVALID';
  end if;

  if exists (
    with recursive ancestor(id, parent_order_id, path, cycle) as (
      select parent.id, parent.parent_order_id, array[parent.id], false
      from public.orders as parent
      where parent.enterprise_id = NEW.enterprise_id
        and parent.id = NEW.parent_order_id
      union all
      select parent.id,
             parent.parent_order_id,
             ancestor.path || parent.id,
             parent.id = any(ancestor.path)
      from ancestor
      join public.orders as parent
        on parent.enterprise_id = NEW.enterprise_id
       and parent.id = ancestor.parent_order_id
      where not ancestor.cycle
    )
    select 1
    from ancestor
    where ancestor.id = NEW.id
  ) then
    raise exception using errcode = '23514', message = 'ORDER_PARENT_CYCLE';
  end if;

  return NEW;
end;
$$;

alter function app_private.enforce_order_parent_graph() owner to v2_function_owner;
revoke all on function app_private.enforce_order_parent_graph()
  from public, anon, authenticated, service_role;

drop trigger if exists orders_parent_graph_guard on public.orders;
create trigger orders_parent_graph_guard
before insert or update of enterprise_id, order_flow, to_enterprise_id, parent_order_id
on public.orders
for each row execute function app_private.enforce_order_parent_graph();

-- Fail rehearsal if historical rows already violate the invariants. This does
-- not rewrite data and prevents a corrupt graph from being declared ready.
do $$
begin
  if exists (
    select 1
    from public.orders as child
    join public.orders as parent
      on parent.enterprise_id = child.enterprise_id
     and parent.id = child.parent_order_id
    where child.parent_order_id = child.id
      or (
        child.order_flow = 'factory_to_supplier'
        and (
          parent.order_flow <> 'dealer_to_factory'
          or parent.to_enterprise_id is distinct from child.enterprise_id
        )
      )
  ) or exists (
    with recursive walk(enterprise_id, root_id, id, parent_order_id, path, cycle) as (
      select orders.enterprise_id,
             orders.id,
             orders.id,
             orders.parent_order_id,
             array[orders.id],
             false
      from public.orders
      where orders.parent_order_id is not null
      union all
      select walk.enterprise_id,
             walk.root_id,
             parent.id,
             parent.parent_order_id,
             walk.path || parent.id,
             parent.id = any(walk.path)
      from walk
      join public.orders as parent
        on parent.enterprise_id = walk.enterprise_id
       and parent.id = walk.parent_order_id
      where not walk.cycle
    )
    select 1 from walk where walk.cycle
  ) then
    raise exception using errcode = '23514', message = 'ORDER_PARENT_GRAPH_LEGACY_INVALID';
  end if;
end;
$$;

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
