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

-- The permission catalog is the sole global catalog exception. Every other
-- IAM table below is tenant-owned and carries a non-null tenant_id.
create table public.permission_catalog (
  code text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

comment on table public.permission_catalog is
  'Global immutable permission-code catalog; the only non-tenant IAM catalog.';

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.enterprises(id),
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, id)
);

create table public.role_permissions (
  tenant_id uuid not null,
  role_id uuid not null,
  permission_code text not null references public.permission_catalog(code),
  created_at timestamptz not null default now(),
  primary key (tenant_id, role_id, permission_code),
  foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id)
    on delete cascade
);

create table public.role_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  role_id uuid not null,
  membership_id uuid not null,
  scope_kind text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id, scope_kind),
  unique (tenant_id, role_id, membership_id, scope_kind),
  constraint role_bindings_scope_kind_check
    check (scope_kind in ('enterprise', 'sites', 'workshops', 'self')),
  foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, membership_id)
    references public.enterprise_memberships(tenant_id, id)
    on delete cascade
);

create table public.role_binding_sites (
  tenant_id uuid not null,
  binding_id uuid not null,
  scope_kind text not null default 'sites',
  site_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, binding_id, site_id),
  constraint role_binding_sites_scope_kind_check
    check (scope_kind = 'sites'),
  foreign key (tenant_id, binding_id, scope_kind)
    references public.role_bindings(tenant_id, id, scope_kind)
    on delete cascade,
  foreign key (tenant_id, site_id)
    references public.sites(tenant_id, id)
    on delete cascade
);

create table public.role_binding_workshops (
  tenant_id uuid not null,
  binding_id uuid not null,
  scope_kind text not null default 'workshops',
  workshop_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, binding_id, workshop_id),
  constraint role_binding_workshops_scope_kind_check
    check (scope_kind = 'workshops'),
  foreign key (tenant_id, binding_id, scope_kind)
    references public.role_bindings(tenant_id, id, scope_kind)
    on delete cascade,
  foreign key (tenant_id, workshop_id)
    references public.workshops(tenant_id, id)
    on delete cascade
);

create index roles_tenant_id_idx
  on public.roles (tenant_id);

create index role_permissions_permission_code_idx
  on public.role_permissions (permission_code);

create index role_bindings_tenant_role_id_idx
  on public.role_bindings (tenant_id, role_id);

create index role_bindings_tenant_membership_id_idx
  on public.role_bindings (tenant_id, membership_id);

create index role_binding_sites_tenant_site_id_idx
  on public.role_binding_sites (tenant_id, site_id);

create index role_binding_workshops_tenant_workshop_id_idx
  on public.role_binding_workshops (tenant_id, workshop_id);

revoke all on table
  public.permission_catalog,
  public.roles,
  public.role_permissions,
  public.role_bindings,
  public.role_binding_sites,
  public.role_binding_workshops
from v2_function_owner;

grant select on table
  public.permission_catalog,
  public.roles,
  public.role_permissions,
  public.role_bindings,
  public.role_binding_sites,
  public.role_binding_workshops,
  public.sites,
  public.workshops
to v2_function_owner;

create function app_private.current_actor_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
return auth.uid();

alter function app_private.current_actor_id()
  owner to v2_function_owner;

revoke all on function app_private.current_actor_id()
  from public, anon, authenticated, service_role;

create function app_private.effective_grants(target_tenant_id uuid)
returns table (
  permission text,
  scope_kind text,
  site_ids uuid[],
  workshop_ids uuid[]
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    role_permission.permission_code as permission,
    binding.scope_kind,
    case
      when binding.scope_kind = 'sites' then array(
        select site_target.site_id
        from public.role_binding_sites site_target
        where site_target.tenant_id = binding.tenant_id
          and site_target.binding_id = binding.id
        order by site_target.site_id
      )
      else '{}'::uuid[]
    end as site_ids,
    case
      when binding.scope_kind = 'workshops' then array(
        select workshop_target.workshop_id
        from public.role_binding_workshops workshop_target
        where workshop_target.tenant_id = binding.tenant_id
          and workshop_target.binding_id = binding.id
        order by workshop_target.workshop_id
      )
      else '{}'::uuid[]
    end as workshop_ids
  from public.enterprise_memberships membership
  join public.enterprises enterprise
    on enterprise.id = membership.tenant_id
  join public.role_bindings binding
    on binding.tenant_id = membership.tenant_id
   and binding.membership_id = membership.id
  join public.role_permissions role_permission
    on role_permission.tenant_id = binding.tenant_id
   and role_permission.role_id = binding.role_id
  where membership.tenant_id = $1
    and membership.user_id = (select app_private.current_actor_id())
    and membership.status = 'active'
    and enterprise.status = 'active'
  order by role_permission.permission_code, binding.id;
$$;

create function app_private.has_permission(
  target_tenant_id uuid,
  permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
return exists (
  select 1
  from app_private.effective_grants($1) grant_row
  where grant_row.permission = $2
);

create function app_private.has_enterprise_permission(
  target_tenant_id uuid,
  permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
return exists (
  select 1
  from app_private.effective_grants($1) grant_row
  where grant_row.permission = $2
    and grant_row.scope_kind = 'enterprise'
);

create function app_private.can_access_site(
  target_tenant_id uuid,
  permission_code text,
  target_site_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
return exists (
  select 1
  from public.sites site
  where site.tenant_id = $1
    and site.id = $3
    and exists (
      select 1
      from app_private.effective_grants($1) grant_row
      where grant_row.permission = $2
        and (
          grant_row.scope_kind = 'enterprise'
          or (
            grant_row.scope_kind = 'sites'
            and $3 = any(grant_row.site_ids)
          )
        )
    )
);

create function app_private.can_access_workshop(
  target_tenant_id uuid,
  permission_code text,
  target_workshop_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
return exists (
  select 1
  from public.workshops workshop
  where workshop.tenant_id = $1
    and workshop.id = $3
    and exists (
      select 1
      from app_private.effective_grants($1) grant_row
      where grant_row.permission = $2
        and (
          grant_row.scope_kind = 'enterprise'
          or (
            grant_row.scope_kind = 'sites'
            and workshop.site_id = any(grant_row.site_ids)
          )
          or (
            grant_row.scope_kind = 'workshops'
            and $3 = any(grant_row.workshop_ids)
          )
        )
    )
);

alter function app_private.effective_grants(uuid)
  owner to v2_function_owner;

alter function app_private.has_permission(uuid, text)
  owner to v2_function_owner;

alter function app_private.has_enterprise_permission(uuid, text)
  owner to v2_function_owner;

alter function app_private.can_access_site(uuid, text, uuid)
  owner to v2_function_owner;

alter function app_private.can_access_workshop(uuid, text, uuid)
  owner to v2_function_owner;

revoke all on function app_private.effective_grants(uuid)
  from public, anon, authenticated, service_role;

revoke all on function app_private.has_permission(uuid, text)
  from public, anon, authenticated, service_role;

revoke all on function app_private.has_enterprise_permission(uuid, text)
  from public, anon, authenticated, service_role;

revoke all on function app_private.can_access_site(uuid, text, uuid)
  from public, anon, authenticated, service_role;

revoke all on function app_private.can_access_workshop(uuid, text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function app_private.effective_grants(uuid)
  to authenticated;

grant execute on function app_private.has_permission(uuid, text)
  to authenticated;

grant execute on function app_private.has_enterprise_permission(uuid, text)
  to authenticated;

grant execute on function app_private.can_access_site(uuid, text, uuid)
  to authenticated;

grant execute on function app_private.can_access_workshop(uuid, text, uuid)
  to authenticated;

create function public.current_enterprise_grants(target_tenant_id uuid)
returns table (
  permission text,
  scope_kind text,
  site_ids uuid[],
  workshop_ids uuid[]
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select
    grant_row.permission,
    grant_row.scope_kind,
    grant_row.site_ids,
    grant_row.workshop_ids
  from app_private.effective_grants($1) grant_row;
$$;

revoke all on function public.current_enterprise_grants(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.current_enterprise_grants(uuid)
  to authenticated;

alter table public.permission_catalog enable row level security;

alter table public.permission_catalog force row level security;

alter table public.roles enable row level security;

alter table public.roles force row level security;

alter table public.role_permissions enable row level security;

alter table public.role_permissions force row level security;

alter table public.role_bindings enable row level security;

alter table public.role_bindings force row level security;

alter table public.role_binding_sites enable row level security;

alter table public.role_binding_sites force row level security;

alter table public.role_binding_workshops enable row level security;

alter table public.role_binding_workshops force row level security;

create policy permission_catalog_select_authenticated
on public.permission_catalog
for select
to authenticated
using (true);

create policy roles_select_roles_manage
on public.roles
for select
to authenticated
using (
  (select app_private.has_enterprise_permission(tenant_id, 'roles.manage'))
);

create policy role_permissions_select_roles_manage
on public.role_permissions
for select
to authenticated
using (
  (select app_private.has_enterprise_permission(tenant_id, 'roles.manage'))
);

create policy role_bindings_select_roles_manage
on public.role_bindings
for select
to authenticated
using (
  (select app_private.has_enterprise_permission(tenant_id, 'roles.manage'))
);

create policy role_binding_sites_select_roles_manage
on public.role_binding_sites
for select
to authenticated
using (
  (select app_private.has_enterprise_permission(tenant_id, 'roles.manage'))
);

create policy role_binding_workshops_select_roles_manage
on public.role_binding_workshops
for select
to authenticated
using (
  (select app_private.has_enterprise_permission(tenant_id, 'roles.manage'))
);

drop policy enterprise_memberships_select_self
on public.enterprise_memberships;

create policy enterprise_memberships_select_self_or_members_read
on public.enterprise_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select app_private.has_enterprise_permission(tenant_id, 'members.read'))
);

create policy sites_select_organization_read
on public.sites
for select
to authenticated
using (
  (select app_private.can_access_site(tenant_id, 'organization.read', id))
);

create policy workshops_select_organization_read
on public.workshops
for select
to authenticated
using (
  (select app_private.can_access_workshop(tenant_id, 'organization.read', id))
);

create policy workstations_select_organization_read
on public.workstations
for select
to authenticated
using (
  (
    select app_private.can_access_workshop(
      tenant_id,
      'organization.read',
      workshop_id
    )
  )
);

create policy org_units_select_organization_read
on public.org_units
for select
to authenticated
using (
  case
    when site_id is null then
      (
        select app_private.has_enterprise_permission(
          tenant_id,
          'organization.read'
        )
      )
    else
      (
        select app_private.can_access_site(
          tenant_id,
          'organization.read',
          site_id
        )
      )
  end
);

revoke all on table
  public.permission_catalog,
  public.roles,
  public.role_permissions,
  public.role_bindings,
  public.role_binding_sites,
  public.role_binding_workshops
from public, anon, authenticated;

grant select on table
  public.permission_catalog,
  public.roles,
  public.role_permissions,
  public.role_bindings,
  public.role_binding_sites,
  public.role_binding_workshops
to authenticated;

grant select on table
  public.sites,
  public.org_units,
  public.workshops,
  public.workstations
to authenticated;

alter group v2_function_owner drop user postgres;
