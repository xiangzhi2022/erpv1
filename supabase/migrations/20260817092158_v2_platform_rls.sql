do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'v2_function_owner'
  ) then
    create role v2_function_owner;
  end if;
end;
$$;

alter role v2_function_owner with nologin noinherit bypassrls;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.roleid = 'v2_function_owner'::regrole
      and membership.member = 'postgres'::regrole
  ) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;

alter group v2_function_owner add user postgres;

create schema if not exists app_private authorization v2_function_owner;

alter schema app_private owner to v2_function_owner;

revoke create on schema public from public;

revoke all on schema app_private from public, anon, authenticated;

revoke all on table
  public.enterprises,
  public.enterprise_memberships,
  public.sites,
  public.org_units,
  public.workshops,
  public.workstations
from v2_function_owner;

grant usage on schema public to v2_function_owner;

grant select on table
  public.enterprises,
  public.enterprise_memberships
to v2_function_owner;

create or replace function app_private.is_active_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
return exists (
    select 1
    from public.enterprise_memberships m
    join public.enterprises e on e.id = m.tenant_id
    where m.tenant_id = target_tenant_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and e.status = 'active'
  );

alter function app_private.is_active_member(uuid) owner to v2_function_owner;

revoke all on function app_private.is_active_member(uuid)
from public, anon, authenticated;

grant usage on schema app_private to authenticated;

grant execute on function app_private.is_active_member(uuid) to authenticated;

alter table public.enterprises enable row level security;

alter table public.enterprises force row level security;

alter table public.enterprise_memberships enable row level security;

alter table public.enterprise_memberships force row level security;

alter table public.sites enable row level security;

alter table public.sites force row level security;

alter table public.org_units enable row level security;

alter table public.org_units force row level security;

alter table public.workshops enable row level security;

alter table public.workshops force row level security;

alter table public.workstations enable row level security;

alter table public.workstations force row level security;

create policy enterprises_select_active_members
on public.enterprises
for select
to authenticated
using ((select app_private.is_active_member(id)));

create policy enterprise_memberships_select_self
on public.enterprise_memberships
for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on table
  public.enterprises,
  public.enterprise_memberships,
  public.sites,
  public.org_units,
  public.workshops,
  public.workstations
from anon, authenticated;

grant select on table
  public.enterprises,
  public.enterprise_memberships
to authenticated;

alter group v2_function_owner drop user postgres;
