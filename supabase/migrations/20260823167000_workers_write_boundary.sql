-- Worker identity links and tenant keys are not ordinary member-management
-- fields. Keep direct writes column-scoped and enforce both the old and new
-- workshop scope for every worker mutation.

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

create function app_private.can_manage_worker_scope(
  target_enterprise_id uuid,
  target_workshop_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
return (
  (
    target_workshop_id is null
    and app_private.has_enterprise_permission(target_enterprise_id, 'members.manage')
  )
  or (
    target_workshop_id is not null
    and app_private.can_access_workshop(
      target_enterprise_id,
      'members.manage',
      target_workshop_id
    )
  )
);

alter function app_private.can_manage_worker_scope(uuid, uuid)
  owner to v2_function_owner;
revoke all on function app_private.can_manage_worker_scope(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function app_private.can_manage_worker_scope(uuid, uuid)
  to authenticated;

create function app_private.set_worker_created_by()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

alter function app_private.set_worker_created_by()
  owner to v2_function_owner;
revoke all on function app_private.set_worker_created_by()
  from public, anon, authenticated, service_role;

drop trigger if exists workers_set_created_by on public.workers;
create trigger workers_set_created_by
before insert on public.workers
for each row execute function app_private.set_worker_created_by();

revoke insert, update, delete on table public.workers from authenticated;

grant insert (
  enterprise_id,
  worker_no,
  name,
  phone,
  gender,
  craft_type,
  workshop_id,
  status,
  skill_tags,
  hire_date,
  remark
) on table public.workers to authenticated;

grant update (
  name,
  phone,
  gender,
  craft_type,
  workshop_id,
  status,
  skill_tags,
  hire_date,
  remark,
  updated_at
) on table public.workers to authenticated;

grant delete on table public.workers to authenticated;

drop policy if exists workers_insert on public.workers;
create policy workers_insert on public.workers
for insert to authenticated
with check (
  app_private.can_manage_worker_scope(workers.enterprise_id, workers.workshop_id)
);

drop policy if exists workers_update on public.workers;
create policy workers_update on public.workers
for update to authenticated
using (
  app_private.can_manage_worker_scope(workers.enterprise_id, workers.workshop_id)
)
with check (
  app_private.can_manage_worker_scope(workers.enterprise_id, workers.workshop_id)
);

drop policy if exists workers_delete on public.workers;
create policy workers_delete on public.workers
for delete to authenticated
using (
  app_private.can_manage_worker_scope(workers.enterprise_id, workers.workshop_id)
);

-- Write routes read the old row and return the new row. Preserve the existing
-- read grants while allowing members.manage only inside its own write scope.
drop policy if exists workers_select on public.workers;
create policy workers_select on public.workers
for select to authenticated
using (
  (
    workers.workshop_id is null
    and (
      app_private.has_enterprise_permission(workers.enterprise_id, 'members.read')
      or app_private.has_enterprise_permission(workers.enterprise_id, 'production.read')
      or app_private.has_enterprise_permission(workers.enterprise_id, 'wages.manage')
    )
  )
  or (
    workers.workshop_id is not null
    and (
      app_private.can_access_workshop(
        workers.enterprise_id,
        'members.read',
        workers.workshop_id
      )
      or app_private.can_access_workshop(
        workers.enterprise_id,
        'production.read',
        workers.workshop_id
      )
      or app_private.can_access_workshop(
        workers.enterprise_id,
        'wages.manage',
        workers.workshop_id
      )
    )
  )
  or app_private.can_manage_worker_scope(workers.enterprise_id, workers.workshop_id)
);

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
