do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_auth_members membership
    where membership.roleid = 'v2_function_owner'::regrole
      and membership.member = 'postgres'::regrole
  ) then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

create table app_private.legacy_identity_mappings (
  id uuid primary key default gen_random_uuid(),
  legacy_source text not null,
  legacy_user_id text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  activation_status text not null default 'pending',
  invited_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legacy_source, legacy_user_id),
  check (activation_status in ('pending', 'invited', 'activated', 'declined', 'invalid'))
);

alter table app_private.legacy_identity_mappings owner to v2_function_owner;
revoke all on table app_private.legacy_identity_mappings
  from public, anon, authenticated, service_role;

grant create on schema public to v2_function_owner;

grant insert on table
  public.enterprises,
  public.enterprise_memberships,
  public.roles,
  public.role_permissions,
  public.role_bindings
to v2_function_owner;

grant select, update on table public.profiles to v2_function_owner;

create function public.onboard_enterprise(
  display_name text,
  enterprise_name text,
  enterprise_type text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
  created_enterprise_id uuid := gen_random_uuid();
  created_membership_id uuid;
  owner_role_id uuid;
  template_enterprise_id uuid;
begin
  if actor_id is null then
    raise exception using
      errcode = '28000',
      message = 'authenticated identity required';
  end if;

  if nullif(btrim(display_name), '') is null
    or char_length(btrim(display_name)) > 100 then
    raise exception using
      errcode = '22023',
      message = 'invalid display name';
  end if;

  if nullif(btrim(enterprise_name), '') is null
    or char_length(btrim(enterprise_name)) > 200 then
    raise exception using
      errcode = '22023',
      message = 'invalid enterprise name';
  end if;

  if enterprise_type is null
    or enterprise_type not in ('manufacturer', 'dealer', 'supplier') then
    raise exception using
      errcode = '22023',
      message = 'invalid enterprise type';
  end if;

  if exists (
    select 1
    from public.enterprise_memberships membership
    where membership.user_id = actor_id
  ) then
    raise exception 'identity already has an enterprise membership';
  end if;

  select enterprise.id
  into template_enterprise_id
  from public.enterprises enterprise
  where enterprise.code = 'platform-profiles';

  if template_enterprise_id is null then
    raise exception using
      errcode = '55000',
      message = 'standard enterprise template is unavailable';
  end if;

  insert into public.enterprises (id, code, name, enterprise_type)
  values (
    created_enterprise_id,
    'erp-' || replace(created_enterprise_id::text, '-', ''),
    btrim(enterprise_name),
    enterprise_type
  );

  insert into public.enterprise_memberships (
    tenant_id,
    user_id,
    status,
    display_name
  ) values (
    created_enterprise_id,
    actor_id,
    'active',
    btrim(display_name)
  )
  returning id into created_membership_id;

  insert into public.roles (
    tenant_id,
    code,
    name,
    description,
    is_system
  )
  select
    created_enterprise_id,
    template_role.code,
    template_role.name,
    template_role.description,
    template_role.is_system
  from public.roles template_role
  where template_role.tenant_id = template_enterprise_id
    and template_role.is_system;

  insert into public.role_permissions (tenant_id, role_id, permission_code)
  select
    created_enterprise_id,
    created_role.id,
    template_permission.permission_code
  from public.role_permissions template_permission
  join public.roles template_role
    on template_role.tenant_id = template_permission.tenant_id
   and template_role.id = template_permission.role_id
  join public.roles created_role
    on created_role.tenant_id = created_enterprise_id
   and created_role.code = template_role.code
  where template_permission.tenant_id = template_enterprise_id;

  select role.id
  into owner_role_id
  from public.roles role
  where role.tenant_id = created_enterprise_id
    and role.code = 'enterprise_owner';

  if owner_role_id is null then
    raise exception using
      errcode = '55000',
      message = 'standard owner role is unavailable';
  end if;

  insert into public.role_bindings (
    tenant_id,
    role_id,
    membership_id,
    scope_kind
  ) values (
    created_enterprise_id,
    owner_role_id,
    created_membership_id,
    'enterprise'
  );

  update public.profiles profile
  set enterprise_id = created_enterprise_id,
      display_name = btrim(onboard_enterprise.display_name),
      updated_at = now()
  where profile.id = actor_id;

  return created_enterprise_id;
end;
$$;

alter function public.onboard_enterprise(text, text, text)
  owner to v2_function_owner;

revoke all on function public.onboard_enterprise(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.onboard_enterprise(text, text, text)
  to authenticated;

comment on function public.onboard_enterprise(text, text, text) is
  'Atomically creates the caller initial enterprise, active owner membership, standard roles, permission matrix, and owner binding.';

comment on table app_private.legacy_identity_mappings is
  'Stable non-credential mapping used while legacy identities activate Supabase Auth accounts.';

revoke create on schema public from v2_function_owner;
alter group v2_function_owner drop user postgres;
