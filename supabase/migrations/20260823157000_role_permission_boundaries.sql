do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_auth_members
    where roleid = 'v2_function_owner'::regrole
      and member = 'postgres'::regrole
  ) then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;

grant select, insert, update, delete on table
  public.roles,
  public.role_permissions
to v2_function_owner;

revoke insert, update, delete on table
  public.roles,
  public.role_permissions
from authenticated;

create function public.create_enterprise_role(
  target_enterprise_id uuid,
  target_code text,
  target_name text,
  target_description text
)
returns jsonb
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
  role_row public.roles%rowtype;
begin
  if actor_id is null then
    raise exception 'permission_denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_enterprise_id::text, 0)
  );

  if not app_private.has_enterprise_permission(target_enterprise_id, 'roles.manage') then
    raise exception 'permission_denied';
  end if;

  if target_code is null
     or target_code <> btrim(target_code)
     or char_length(target_code) not between 1 and 80
     or target_code !~ '^[a-z][a-z0-9_.-]*$' then
    raise exception using errcode = '22023', message = 'invalid_role_code';
  end if;
  if target_code = any(array[
    'enterprise_owner', 'enterprise_admin', 'order_manager',
    'production_manager', 'worker', 'quality_inspector', 'finance',
    'warehouse', 'dealer_operator', 'supplier_operator'
  ]::text[]) then
    raise exception 'system_role_code_reserved';
  end if;
  if target_name is null
     or nullif(btrim(target_name), '') is null
     or char_length(btrim(target_name)) > 100 then
    raise exception using errcode = '22023', message = 'invalid_role_name';
  end if;
  if target_description is not null and char_length(btrim(target_description)) > 500 then
    raise exception using errcode = '22023', message = 'invalid_role_description';
  end if;

  insert into public.roles(tenant_id, code, name, description, is_system)
  values (
    target_enterprise_id,
    target_code,
    btrim(target_name),
    case when target_description is null then null else btrim(target_description) end,
    false
  )
  returning * into role_row;

  return pg_catalog.to_jsonb(role_row);
end;
$$;

create function public.update_enterprise_role(
  target_enterprise_id uuid,
  target_role_id uuid,
  target_code text,
  target_name text,
  target_description text,
  update_code boolean,
  update_name boolean,
  update_description boolean
)
returns jsonb
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
  role_row public.roles%rowtype;
begin
  if actor_id is null then
    raise exception 'permission_denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_enterprise_id::text, 0)
  );

  if not app_private.has_enterprise_permission(target_enterprise_id, 'roles.manage') then
    raise exception 'permission_denied';
  end if;
  if not coalesce(update_code, false)
     and not coalesce(update_name, false)
     and not coalesce(update_description, false) then
    raise exception using errcode = '22023', message = 'no_role_updates';
  end if;

  select * into role_row
  from public.roles role
  where role.tenant_id = target_enterprise_id
    and role.id = target_role_id
  for update;
  if not found then
    raise exception 'role_not_found';
  end if;
  if role_row.code = 'enterprise_owner'
     and not app_private.actor_is_enterprise_owner(target_enterprise_id) then
    raise exception 'owner_protected';
  end if;
  if role_row.is_system and coalesce(update_code, false) then
    raise exception 'system_role_code_protected';
  end if;

  if coalesce(update_code, false)
     and (
       target_code is null
       or target_code <> btrim(target_code)
       or char_length(target_code) not between 1 and 80
       or target_code !~ '^[a-z][a-z0-9_.-]*$'
  ) then
    raise exception using errcode = '22023', message = 'invalid_role_code';
  end if;
  if coalesce(update_code, false)
     and target_code = any(array[
       'enterprise_owner', 'enterprise_admin', 'order_manager',
       'production_manager', 'worker', 'quality_inspector', 'finance',
       'warehouse', 'dealer_operator', 'supplier_operator'
     ]::text[]) then
    raise exception 'system_role_code_reserved';
  end if;
  if coalesce(update_name, false)
     and (
       target_name is null
       or nullif(btrim(target_name), '') is null
       or char_length(btrim(target_name)) > 100
     ) then
    raise exception using errcode = '22023', message = 'invalid_role_name';
  end if;
  if coalesce(update_description, false)
     and target_description is not null
     and char_length(btrim(target_description)) > 500 then
    raise exception using errcode = '22023', message = 'invalid_role_description';
  end if;

  update public.roles role
  set code = case when coalesce(update_code, false) then target_code else role.code end,
      name = case when coalesce(update_name, false) then btrim(target_name) else role.name end,
      description = case
        when coalesce(update_description, false) then
          case when target_description is null then null else btrim(target_description) end
        else role.description
      end,
      updated_at = now()
  where role.tenant_id = target_enterprise_id
    and role.id = target_role_id
  returning * into role_row;

  return pg_catalog.to_jsonb(role_row);
end;
$$;

create function public.set_enterprise_role_permissions(
  target_enterprise_id uuid,
  target_role_id uuid,
  target_permission_codes text[]
)
returns text[]
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
  role_row public.roles%rowtype;
  normalized_codes text[];
begin
  if actor_id is null then
    raise exception 'permission_denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_enterprise_id::text, 0)
  );

  if not app_private.has_enterprise_permission(target_enterprise_id, 'roles.manage') then
    raise exception 'permission_denied';
  end if;
  if pg_catalog.cardinality(coalesce(target_permission_codes, array[]::text[])) > 200 then
    raise exception using errcode = '22023', message = 'too_many_permissions';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(coalesce(target_permission_codes, array[]::text[])) requested(permission_code)
    where requested.permission_code is null
       or requested.permission_code <> btrim(requested.permission_code)
       or nullif(requested.permission_code, '') is null
  ) then
    raise exception using errcode = '22023', message = 'invalid_permission_code';
  end if;

  select coalesce(
    pg_catalog.array_agg(distinct requested.permission_code order by requested.permission_code),
    array[]::text[]
  ) into normalized_codes
  from pg_catalog.unnest(coalesce(target_permission_codes, array[]::text[])) requested(permission_code);

  if exists (
    select 1
    from pg_catalog.unnest(normalized_codes) requested(permission_code)
    where not exists (
      select 1
      from public.permission_catalog permission
      where permission.code = requested.permission_code
    )
  ) then
    raise exception using errcode = '22023', message = 'invalid_permission_code';
  end if;

  select * into role_row
  from public.roles role
  where role.tenant_id = target_enterprise_id
    and role.id = target_role_id
  for update;
  if not found then
    raise exception 'role_not_found';
  end if;
  if role_row.code = 'enterprise_owner'
     and not app_private.actor_is_enterprise_owner(target_enterprise_id) then
    raise exception 'owner_protected';
  end if;

  if not app_private.actor_is_enterprise_owner(target_enterprise_id)
     and exists (
    select 1
    from pg_catalog.unnest(normalized_codes) requested(permission_code)
    where not exists (
      select 1
      from app_private.effective_grants(target_enterprise_id) actor_grant
      where actor_grant.scope_kind = 'enterprise'
        and actor_grant.permission = requested.permission_code
    )
  ) then
    raise exception 'permission_not_assignable';
  end if;
  if role_row.code = 'enterprise_owner'
     and (
       select count(*)
       from pg_catalog.unnest(normalized_codes) requested(permission_code)
       where permission_code = any(array['roles.manage','members.manage']::text[])
     ) <> 2 then
    raise exception 'owner_minimum_permissions_required';
  end if;

  delete from public.role_permissions role_permission
  where role_permission.tenant_id = target_enterprise_id
    and role_permission.role_id = target_role_id;

  insert into public.role_permissions(tenant_id, role_id, permission_code)
  select target_enterprise_id, target_role_id, requested.permission_code
  from pg_catalog.unnest(normalized_codes) requested(permission_code);

  update public.roles role
  set updated_at = now()
  where role.tenant_id = target_enterprise_id
    and role.id = target_role_id;

  return normalized_codes;
end;
$$;

alter function public.create_enterprise_role(uuid, text, text, text)
  owner to v2_function_owner;
alter function public.update_enterprise_role(uuid, uuid, text, text, text, boolean, boolean, boolean)
  owner to v2_function_owner;
alter function public.set_enterprise_role_permissions(uuid, uuid, text[])
  owner to v2_function_owner;

revoke all on function public.create_enterprise_role(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.update_enterprise_role(uuid, uuid, text, text, text, boolean, boolean, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.set_enterprise_role_permissions(uuid, uuid, text[])
  from public, anon, authenticated, service_role;

grant execute on function public.create_enterprise_role(uuid, text, text, text)
  to authenticated;
grant execute on function public.update_enterprise_role(uuid, uuid, text, text, text, boolean, boolean, boolean)
  to authenticated;
grant execute on function public.set_enterprise_role_permissions(uuid, uuid, text[])
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
