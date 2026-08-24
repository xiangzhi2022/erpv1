do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_auth_members
    where roleid = 'v2_function_owner'::regrole and member = 'postgres'::regrole
  ) then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;

create table app_private.auth_recovery_proofs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nonce_hash text not null unique check (nonce_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table app_private.auth_recovery_proofs owner to v2_function_owner;
revoke all on table app_private.auth_recovery_proofs from public, anon, authenticated, service_role;

create table app_private.auth_recovery_flows (
  nonce_hash text primary key check (nonce_hash ~ '^[0-9a-f]{64}$'),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table app_private.auth_recovery_flows owner to v2_function_owner;
revoke all on table app_private.auth_recovery_flows from public, anon, authenticated, service_role;
create index auth_recovery_flows_expires_at_idx on app_private.auth_recovery_flows(expires_at);

grant select, insert, update, delete on table
  public.enterprise_memberships,
  public.role_bindings,
  public.enterprise_join_requests,
  public.employees,
  public.employee_positions,
  public.employee_roles
to v2_function_owner;
grant select on table public.roles, public.profiles, public.positions, public.enterprises to v2_function_owner;

drop policy if exists enterprise_join_requests_insert on public.enterprise_join_requests;
drop policy if exists enterprise_join_requests_update on public.enterprise_join_requests;
drop policy if exists enterprise_join_requests_delete on public.enterprise_join_requests;
drop policy if exists enterprise_join_requests_insert_own on public.enterprise_join_requests;
drop policy if exists enterprise_join_requests_cancel_own on public.enterprise_join_requests;
drop policy if exists enterprise_join_requests_resubmit_own on public.enterprise_join_requests;
revoke insert, update, delete on table public.enterprise_join_requests from authenticated;

drop policy if exists employees_insert on public.employees;
drop policy if exists employees_update on public.employees;
drop policy if exists employees_delete on public.employees;
drop policy if exists employee_positions_insert on public.employee_positions;
drop policy if exists employee_positions_update on public.employee_positions;
drop policy if exists employee_positions_delete on public.employee_positions;
drop policy if exists employee_roles_insert on public.employee_roles;
drop policy if exists employee_roles_update on public.employee_roles;
drop policy if exists employee_roles_delete on public.employee_roles;
revoke insert, update, delete on table
  public.employees,
  public.employee_positions,
  public.employee_roles
from authenticated;

create function public.register_recovery_proof(target_nonce_hash text, target_expires_at timestamptz)
returns void language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
begin
  if actor_id is null then raise exception using errcode = '28000', message = 'authenticated identity required'; end if;
  if target_nonce_hash !~ '^[0-9a-f]{64}$'
     or target_expires_at <= now()
     or target_expires_at > now() + interval '15 minutes' then
    raise exception using errcode = '22023', message = 'invalid recovery proof';
  end if;
  insert into app_private.auth_recovery_proofs(user_id, nonce_hash, expires_at)
  values (actor_id, target_nonce_hash, target_expires_at)
  on conflict (user_id) do update
    set nonce_hash = excluded.nonce_hash, expires_at = excluded.expires_at, created_at = now();
end;
$$;

create function public.consume_recovery_proof(target_nonce_hash text)
returns boolean language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
  removed_count integer;
begin
  if actor_id is null then return false; end if;
  delete from app_private.auth_recovery_proofs proof
   where proof.user_id = actor_id
     and proof.nonce_hash = target_nonce_hash
     and proof.expires_at > now();
  get diagnostics removed_count = row_count;
  return removed_count = 1;
end;
$$;

create function public.register_recovery_flow(
  target_nonce_hash text,
  target_email_hash text,
  target_expires_at timestamptz
) returns void language plpgsql volatile security definer set search_path = pg_catalog as $$
begin
  if target_nonce_hash !~ '^[0-9a-f]{64}$'
     or target_email_hash !~ '^[0-9a-f]{64}$'
     or target_expires_at <= now()
     or target_expires_at > now() + interval '15 minutes' then
    raise exception using errcode = '22023', message = 'invalid recovery flow';
  end if;
  delete from app_private.auth_recovery_flows where expires_at <= now();
  insert into app_private.auth_recovery_flows(nonce_hash, email_hash, expires_at)
  values (target_nonce_hash, target_email_hash, target_expires_at)
  on conflict (nonce_hash) do update
    set email_hash = excluded.email_hash, expires_at = excluded.expires_at, created_at = now();
end;
$$;

create function public.consume_recovery_flow(target_nonce_hash text, target_email_hash text)
returns boolean language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  removed_count integer;
begin
  delete from app_private.auth_recovery_flows flow
   where flow.nonce_hash = target_nonce_hash
     and flow.email_hash = target_email_hash
     and flow.expires_at > now();
  get diagnostics removed_count = row_count;
  return removed_count = 1;
end;
$$;

create function app_private.actor_is_enterprise_owner(target_tenant_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog return exists (
  select 1 from public.enterprise_memberships membership
  join public.role_bindings binding on binding.tenant_id = membership.tenant_id and binding.membership_id = membership.id
  join public.roles role on role.tenant_id = binding.tenant_id and role.id = binding.role_id
  where membership.tenant_id = target_tenant_id
    and membership.user_id = app_private.current_actor_id()
    and membership.status = 'active'
    and binding.scope_kind = 'enterprise'
    and role.code = 'enterprise_owner'
);

create function app_private.membership_is_enterprise_owner(target_tenant_id uuid, target_membership_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog return exists (
  select 1 from public.role_bindings binding
  join public.roles role on role.tenant_id = binding.tenant_id and role.id = binding.role_id
  where binding.tenant_id = target_tenant_id and binding.membership_id = target_membership_id
    and binding.scope_kind = 'enterprise' and role.code = 'enterprise_owner'
);

create function app_private.active_enterprise_owner_count(target_tenant_id uuid)
returns bigint language sql stable security definer set search_path = pg_catalog return (
  select count(distinct membership.id) from public.enterprise_memberships membership
  join public.role_bindings binding on binding.tenant_id = membership.tenant_id and binding.membership_id = membership.id
  join public.roles role on role.tenant_id = binding.tenant_id and role.id = binding.role_id
  where membership.tenant_id = target_tenant_id and membership.status = 'active'
    and binding.scope_kind = 'enterprise' and role.code = 'enterprise_owner'
);

create function app_private.actor_can_assign_role(target_tenant_id uuid, target_role_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog return exists (
  select 1 from public.roles role
  where role.tenant_id = target_tenant_id and role.id = target_role_id
    and (role.code <> 'enterprise_owner' or app_private.actor_is_enterprise_owner(target_tenant_id))
    and not exists (
      select 1 from public.role_permissions target_permission
      where target_permission.tenant_id = target_tenant_id and target_permission.role_id = target_role_id
        and not exists (
          select 1 from app_private.effective_grants(target_tenant_id) actor_grant
          where actor_grant.scope_kind = 'enterprise'
            and actor_grant.permission = target_permission.permission_code
        )
    )
);

create function public.update_enterprise_member(
  target_enterprise_id uuid,
  target_user_id uuid,
  target_display_name text,
  target_status text,
  target_role_id uuid
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
  member public.enterprise_memberships%rowtype;
  target_is_owner boolean;
  new_role_is_owner boolean := false;
  resulting_status text;
  linked_employee_id uuid;
begin
  if actor_id is null or not app_private.has_enterprise_permission(target_enterprise_id, 'members.manage') then
    raise exception 'permission_denied';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_enterprise_id::text,0));
  select * into member from public.enterprise_memberships
   where tenant_id = target_enterprise_id and user_id = target_user_id for update;
  if not found then raise exception 'member_not_found'; end if;
  target_is_owner := app_private.membership_is_enterprise_owner(target_enterprise_id, member.id);
  if target_is_owner and not app_private.actor_is_enterprise_owner(target_enterprise_id) then
    raise exception 'owner_protected';
  end if;
  if target_status is not null and target_status not in ('active', 'suspended') then
    raise exception using errcode = '22023', message = 'invalid_member_status';
  end if;
  if target_display_name is not null and (nullif(btrim(target_display_name), '') is null or char_length(btrim(target_display_name)) > 100) then
    raise exception using errcode = '22023', message = 'invalid_display_name';
  end if;
  if target_role_id is not null then
    if not app_private.has_enterprise_permission(target_enterprise_id, 'roles.manage') then
      raise exception 'permission_denied';
    end if;
    if not app_private.actor_can_assign_role(target_enterprise_id, target_role_id) then raise exception 'role_not_assignable'; end if;
    select code = 'enterprise_owner' into new_role_is_owner from public.roles
     where tenant_id = target_enterprise_id and id = target_role_id;
  end if;
  resulting_status := coalesce(target_status, member.status);
  if target_is_owner and (resulting_status <> 'active' or (target_role_id is not null and not new_role_is_owner))
     and app_private.active_enterprise_owner_count(target_enterprise_id) <= 1 then raise exception 'last_owner_required'; end if;
  if actor_id = target_user_id and resulting_status <> 'active' then raise exception 'cannot_suspend_self'; end if;
  if member.status <> 'active' and resulting_status = 'active' and target_role_id is null then raise exception 'role_required'; end if;
  update public.enterprise_memberships
     set display_name = coalesce(btrim(target_display_name), display_name),
         status = coalesce(target_status, status), updated_at = now()
   where tenant_id = target_enterprise_id and id = member.id;
  if resulting_status <> 'active' then
    delete from public.role_bindings where tenant_id = target_enterprise_id and membership_id = member.id;
  elsif target_role_id is not null then
    delete from public.role_bindings where tenant_id = target_enterprise_id and membership_id = member.id;
    insert into public.role_bindings(tenant_id, role_id, membership_id, scope_kind)
    values (target_enterprise_id, target_role_id, member.id, 'enterprise');
    select id into linked_employee_id
    from public.employees
    where enterprise_id = target_enterprise_id and user_id = target_user_id;
    if linked_employee_id is not null then
      delete from public.employee_roles
      where enterprise_id = target_enterprise_id and employee_id = linked_employee_id;
      insert into public.employee_roles(enterprise_id,employee_id,role_id)
      values (target_enterprise_id,linked_employee_id,target_role_id);
    end if;
  end if;
  return pg_catalog.jsonb_build_object('user_id', target_user_id, 'membership_id', member.id);
end;
$$;

create function public.remove_enterprise_member(target_enterprise_id uuid, target_user_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
  removed_count integer;
  member public.enterprise_memberships%rowtype;
begin
  if actor_id is null or not app_private.has_enterprise_permission(target_enterprise_id, 'members.manage') then
    raise exception 'permission_denied';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_enterprise_id::text,0));
  if actor_id = target_user_id then raise exception 'cannot_remove_self'; end if;
  select * into member from public.enterprise_memberships where tenant_id = target_enterprise_id and user_id = target_user_id for update;
  if not found then raise exception 'member_not_found'; end if;
  if app_private.membership_is_enterprise_owner(target_enterprise_id, member.id) then
    if not app_private.actor_is_enterprise_owner(target_enterprise_id) then raise exception 'owner_protected'; end if;
    if app_private.active_enterprise_owner_count(target_enterprise_id) <= 1 then raise exception 'last_owner_required'; end if;
  end if;
  delete from public.enterprise_memberships where tenant_id = target_enterprise_id and id = member.id;
  get diagnostics removed_count = row_count;
  if removed_count = 0 then raise exception 'member_not_found'; end if;
end;
$$;

create function public.replace_employee_role_bindings(
  target_enterprise_id uuid,
  target_user_id uuid,
  target_role_ids uuid[]
) returns void language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  member_id uuid;
  existing_member_status text;
  target_is_owner boolean;
  keeps_owner boolean;
  candidate_role_id uuid;
begin
  if not app_private.has_enterprise_permission(target_enterprise_id, 'roles.manage') then
    raise exception 'permission_denied';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_enterprise_id::text,0));
  select id into member_id from public.enterprise_memberships
   where tenant_id = target_enterprise_id and user_id = target_user_id and status = 'active' for update;
  if member_id is null then raise exception 'active_member_not_found'; end if;
  if (select count(*) from public.roles where tenant_id = target_enterprise_id and id = any(coalesce(target_role_ids, array[]::uuid[])))
     <> coalesce(pg_catalog.array_length(target_role_ids, 1), 0) then
    raise exception 'role_not_found';
  end if;
  target_is_owner := app_private.membership_is_enterprise_owner(target_enterprise_id, member_id);
  if target_is_owner and not app_private.actor_is_enterprise_owner(target_enterprise_id) then raise exception 'owner_protected'; end if;
  foreach candidate_role_id in array coalesce(target_role_ids,array[]::uuid[]) loop
    if not app_private.actor_can_assign_role(target_enterprise_id,candidate_role_id) then raise exception 'role_not_assignable'; end if;
  end loop;
  select exists (
    select 1 from public.roles where tenant_id = target_enterprise_id
      and id = any(coalesce(target_role_ids,array[]::uuid[])) and code = 'enterprise_owner'
  ) into keeps_owner;
  if target_is_owner and not keeps_owner and app_private.active_enterprise_owner_count(target_enterprise_id) <= 1 then
    raise exception 'last_owner_required';
  end if;
  delete from public.role_bindings
   where tenant_id = target_enterprise_id and membership_id = member_id;
  insert into public.role_bindings(tenant_id, role_id, membership_id, scope_kind)
  select target_enterprise_id, role_id, member_id, 'enterprise'
  from pg_catalog.unnest(coalesce(target_role_ids, array[]::uuid[])) role_id;
end;
$$;

create function public.save_employee_with_relations(
  target_enterprise_id uuid,
  target_employee_id uuid,
  target_user_id uuid,
  target_fields jsonb,
  target_position_ids uuid[],
  target_primary_position_id uuid,
  target_role_ids uuid[]
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
  employee_row public.employees%rowtype;
  old_user_id uuid;
  employee_status text;
  old_membership_id uuid;
  old_is_owner boolean := false;
  will_assign_owner boolean := false;
  candidate_role_id uuid;
  requested_base_salary numeric;
begin
  if actor_id is null or not app_private.has_enterprise_permission(target_enterprise_id, 'members.manage') then
    raise exception 'permission_denied';
  end if;
  if not app_private.has_enterprise_permission(target_enterprise_id, 'roles.manage') then
    raise exception 'permission_denied';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_enterprise_id::text,0));
  if exists (
    select 1 from pg_catalog.jsonb_object_keys(coalesce(target_fields, '{}'::jsonb)) as keys(key_name)
    where key_name not in ('employee_no','name','phone','email','avatar_url','department_id','employee_type','status','hire_date','leave_date','base_salary','remark')
  ) then raise exception using errcode = '22023', message = 'invalid_employee_field'; end if;
  if target_user_id is not null and not exists (
    select 1 from public.enterprise_memberships
    where tenant_id = target_enterprise_id and user_id = target_user_id and status = 'active'
  ) then raise exception 'active_member_not_found'; end if;
  if (select count(*) from public.roles where tenant_id = target_enterprise_id and id = any(coalesce(target_role_ids, array[]::uuid[])))
     <> coalesce(pg_catalog.array_length(target_role_ids, 1), 0) then raise exception 'role_not_found'; end if;
  foreach candidate_role_id in array coalesce(target_role_ids,array[]::uuid[]) loop
    if not app_private.actor_can_assign_role(target_enterprise_id,candidate_role_id) then
      raise exception 'role_not_assignable';
    end if;
  end loop;
  if (select count(*) from public.positions where enterprise_id = target_enterprise_id and id = any(coalesce(target_position_ids, array[]::uuid[])))
     <> coalesce(pg_catalog.array_length(target_position_ids, 1), 0) then raise exception 'position_not_found'; end if;
  select exists (
    select 1 from public.roles where tenant_id = target_enterprise_id
      and id = any(coalesce(target_role_ids,array[]::uuid[])) and code = 'enterprise_owner'
  ) into will_assign_owner;
  if target_primary_position_id is not null and not exists (
    select 1 from public.positions where enterprise_id = target_enterprise_id and id = target_primary_position_id
  ) then raise exception 'position_not_found'; end if;
  if target_primary_position_id is not null and not (target_primary_position_id = any(coalesce(target_position_ids,array[]::uuid[]))) then
    raise exception using errcode = '22023', message = 'primary_position_not_assigned';
  end if;
  if target_fields ? 'base_salary' then
    requested_base_salary := coalesce((target_fields ->> 'base_salary')::numeric,0);
  end if;

  if target_employee_id is null then
    if nullif(btrim(target_fields ->> 'employee_no'), '') is null or nullif(btrim(target_fields ->> 'name'), '') is null then
      raise exception using errcode = '22023', message = 'employee_name_and_number_required';
    end if;
    if requested_base_salary <> 0
      and not app_private.has_enterprise_permission(target_enterprise_id,'wages.manage') then
      raise exception 'wage_permission_denied';
    end if;
    insert into public.employees(
      enterprise_id,user_id,employee_no,name,phone,email,avatar_url,department_id,primary_position_id,
      employee_type,status,hire_date,leave_date,base_salary,remark
    ) values (
      target_enterprise_id,target_user_id,btrim(target_fields ->> 'employee_no'),btrim(target_fields ->> 'name'),
      target_fields ->> 'phone',target_fields ->> 'email',target_fields ->> 'avatar_url',(target_fields ->> 'department_id')::uuid,
      target_primary_position_id,coalesce(target_fields ->> 'employee_type','full_time'),coalesce(target_fields ->> 'status','active'),
      (target_fields ->> 'hire_date')::date,(target_fields ->> 'leave_date')::date,coalesce((target_fields ->> 'base_salary')::numeric,0),
      target_fields ->> 'remark'
    ) returning * into employee_row;
  else
    select * into employee_row from public.employees
     where enterprise_id = target_enterprise_id and id = target_employee_id for update;
    if not found then raise exception 'employee_not_found'; end if;
    if requested_base_salary is distinct from employee_row.base_salary
      and target_fields ? 'base_salary'
      and not app_private.has_enterprise_permission(target_enterprise_id,'wages.manage') then
      raise exception 'wage_permission_denied';
    end if;
    old_user_id := employee_row.user_id;
    if old_user_id is not null then
      select id into old_membership_id from public.enterprise_memberships
       where tenant_id = target_enterprise_id and user_id = old_user_id for update;
      old_is_owner := old_membership_id is not null
        and app_private.membership_is_enterprise_owner(target_enterprise_id,old_membership_id);
      if old_is_owner and not app_private.actor_is_enterprise_owner(target_enterprise_id) then raise exception 'owner_protected'; end if;
    end if;
    update public.employees set
      user_id = target_user_id,
      employee_no = case when target_fields ? 'employee_no' then target_fields ->> 'employee_no' else employee_no end,
      name = case when target_fields ? 'name' then target_fields ->> 'name' else name end,
      phone = case when target_fields ? 'phone' then target_fields ->> 'phone' else phone end,
      email = case when target_fields ? 'email' then target_fields ->> 'email' else email end,
      avatar_url = case when target_fields ? 'avatar_url' then target_fields ->> 'avatar_url' else avatar_url end,
      department_id = case when target_fields ? 'department_id' then (target_fields ->> 'department_id')::uuid else department_id end,
      primary_position_id = target_primary_position_id,
      employee_type = case when target_fields ? 'employee_type' then target_fields ->> 'employee_type' else employee_type end,
      status = case when target_fields ? 'status' then target_fields ->> 'status' else status end,
      hire_date = case when target_fields ? 'hire_date' then (target_fields ->> 'hire_date')::date else hire_date end,
      leave_date = case when target_fields ? 'leave_date' then (target_fields ->> 'leave_date')::date else leave_date end,
      base_salary = case when target_fields ? 'base_salary' then (target_fields ->> 'base_salary')::numeric else base_salary end,
      remark = case when target_fields ? 'remark' then target_fields ->> 'remark' else remark end,
      updated_at = now()
    where enterprise_id = target_enterprise_id and id = target_employee_id
    returning * into employee_row;
  end if;
  employee_status := employee_row.status;
  if nullif(btrim(employee_row.employee_no),'') is null or nullif(btrim(employee_row.name),'') is null then
    raise exception using errcode = '22023', message = 'employee_name_and_number_required';
  end if;
  if employee_status not in ('active','inactive','departed') then
    raise exception using errcode = '22023', message = 'invalid_employee_status';
  end if;
  if old_is_owner and (target_user_id is distinct from old_user_id or employee_status <> 'active')
     and not (target_user_id is not null and employee_status = 'active' and will_assign_owner)
     and app_private.active_enterprise_owner_count(target_enterprise_id) <= 1 then raise exception 'last_owner_required'; end if;
  if actor_id = old_user_id and (target_user_id is distinct from old_user_id or employee_status <> 'active') then
    raise exception 'cannot_deactivate_self';
  end if;

  delete from public.employee_positions where enterprise_id = target_enterprise_id and employee_id = employee_row.id;
  insert into public.employee_positions(enterprise_id,employee_id,position_id,is_primary)
  select target_enterprise_id,employee_row.id,position_id,position_id = target_primary_position_id
  from pg_catalog.unnest(coalesce(target_position_ids,array[]::uuid[])) position_id;
  delete from public.employee_roles where enterprise_id = target_enterprise_id and employee_id = employee_row.id;
  insert into public.employee_roles(enterprise_id,employee_id,role_id)
  select target_enterprise_id,employee_row.id,role_id
  from pg_catalog.unnest(coalesce(target_role_ids,array[]::uuid[])) role_id;

  if old_user_id is not null and (old_user_id is distinct from target_user_id or employee_status <> 'active') then
    delete from public.role_bindings binding using public.enterprise_memberships membership
    where binding.tenant_id = target_enterprise_id and binding.membership_id = membership.id
      and membership.tenant_id = target_enterprise_id and membership.user_id = old_user_id;
  end if;
  if target_user_id is not null and employee_status = 'active' then
    perform public.replace_employee_role_bindings(target_enterprise_id,target_user_id,coalesce(target_role_ids,array[]::uuid[]));
  end if;
  if app_private.has_enterprise_permission(target_enterprise_id, 'wages.read.all') then
    return pg_catalog.to_jsonb(employee_row);
  end if;
  return pg_catalog.to_jsonb(employee_row) - 'base_salary';
end;
$$;

create function public.delete_employee_with_access(
  target_enterprise_id uuid,
  target_employee_id uuid,
  target_hard_delete boolean
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
  employee_row public.employees%rowtype;
  employee_membership_id uuid;
begin
  if actor_id is null or not app_private.has_enterprise_permission(target_enterprise_id, 'members.manage')
     or not app_private.has_enterprise_permission(target_enterprise_id, 'roles.manage') then
    raise exception 'permission_denied';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_enterprise_id::text,0));
  select * into employee_row from public.employees
   where enterprise_id = target_enterprise_id and id = target_employee_id for update;
  if not found then raise exception 'employee_not_found'; end if;
  if employee_row.user_id = actor_id then raise exception 'cannot_deactivate_self'; end if;
  if employee_row.user_id is not null then
    select id into employee_membership_id from public.enterprise_memberships
     where tenant_id = target_enterprise_id and user_id = employee_row.user_id for update;
    if employee_membership_id is not null and app_private.membership_is_enterprise_owner(target_enterprise_id,employee_membership_id) then
      if not app_private.actor_is_enterprise_owner(target_enterprise_id) then raise exception 'owner_protected'; end if;
      if app_private.active_enterprise_owner_count(target_enterprise_id) <= 1 then raise exception 'last_owner_required'; end if;
    end if;
  end if;
  if employee_row.user_id is not null then
    delete from public.role_bindings binding using public.enterprise_memberships membership
    where binding.tenant_id = target_enterprise_id and binding.membership_id = membership.id
      and membership.tenant_id = target_enterprise_id and membership.user_id = employee_row.user_id;
  end if;
  if target_hard_delete then
    delete from public.employees where enterprise_id = target_enterprise_id and id = target_employee_id;
    return pg_catalog.jsonb_build_object('mode','deleted');
  end if;
  update public.employees set status = 'inactive', leave_date = coalesce(leave_date,current_date), updated_at = now()
   where enterprise_id = target_enterprise_id and id = target_employee_id;
  return pg_catalog.jsonb_build_object('mode','inactive');
end;
$$;

create function public.handle_enterprise_join_request(
  target_request_id uuid,
  target_action text,
  target_reason text
) returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
  request_row public.enterprise_join_requests%rowtype;
  member_id uuid;
  worker_role_id uuid;
  display_value text;
  phone_value text;
  v_employee_id uuid;
  existing_member_status text;
begin
  if actor_id is null then raise exception 'permission_denied'; end if;
  if target_action is null
    or target_action not in ('approve', 'reject', 'cancel')
    or char_length(coalesce(target_reason, '')) > 500 then
    raise exception using errcode = '22023', message = 'invalid_join_request_action';
  end if;
  select * into request_row from public.enterprise_join_requests where id = target_request_id for update;
  if not found then raise exception 'join_request_not_found'; end if;
  if request_row.status <> 'pending' then raise exception 'join_request_already_handled'; end if;
  if target_action = 'cancel' then
    if request_row.user_id <> actor_id then raise exception 'permission_denied'; end if;
    update public.enterprise_join_requests set status = 'cancelled', handled_by = actor_id,
      handled_at = now(), updated_at = now() where id = request_row.id;
    return pg_catalog.jsonb_build_object('status', 'cancelled');
  end if;
  if not app_private.has_enterprise_permission(request_row.enterprise_id, 'members.manage') then
    raise exception 'permission_denied';
  end if;
  if target_action = 'reject' then
    update public.enterprise_join_requests set status = 'rejected', handled_by = actor_id,
      handled_at = now(), message = coalesce(target_reason, message), updated_at = now()
      where id = request_row.id;
    return pg_catalog.jsonb_build_object('status', 'rejected');
  end if;
  if coalesce(request_row.requested_role_code, 'worker') not in ('worker', 'employee') then
    raise exception 'requested_role_not_allowed';
  end if;
  select id,status into member_id,existing_member_status from public.enterprise_memberships
   where tenant_id = request_row.enterprise_id and user_id = request_row.user_id for update;
  if found and existing_member_status = 'active' then raise exception 'already_active_member'; end if;
  select id into worker_role_id from public.roles
   where tenant_id = request_row.enterprise_id and code = 'worker';
  if worker_role_id is null then raise exception 'role_not_found'; end if;
  if not app_private.actor_can_assign_role(request_row.enterprise_id,worker_role_id) then raise exception 'role_not_assignable'; end if;
  select coalesce(nullif(display_name, ''), nullif(phone, ''), '新成员'), phone
    into display_value, phone_value from public.profiles where id = request_row.user_id;
  display_value := coalesce(display_value, '新成员');
  insert into public.enterprise_memberships(tenant_id, user_id, display_name, status)
  values (request_row.enterprise_id, request_row.user_id, display_value, 'active')
  on conflict (tenant_id, user_id) do update set display_name = excluded.display_name, status = 'active', updated_at = now()
  returning id into member_id;
  delete from public.role_bindings where tenant_id = request_row.enterprise_id
    and membership_id = member_id;
  insert into public.role_bindings(tenant_id, role_id, membership_id, scope_kind)
  values (request_row.enterprise_id, worker_role_id, member_id, 'enterprise');
  insert into public.employees(enterprise_id, user_id, employee_no, name, phone, status)
  values (request_row.enterprise_id, request_row.user_id,
    'E' || upper(substr(replace(request_row.id::text, '-', ''), 1, 12)), display_value, phone_value, 'active')
  on conflict (enterprise_id, user_id) do update set name = excluded.name, phone = coalesce(excluded.phone, employees.phone), status = 'active', updated_at = now()
  returning id into v_employee_id;
  delete from public.employee_roles where enterprise_id = request_row.enterprise_id and employee_id = v_employee_id;
  insert into public.employee_roles(enterprise_id,employee_id,role_id)
  values (request_row.enterprise_id,v_employee_id,worker_role_id);
  update public.enterprise_join_requests set status = 'approved', handled_by = actor_id,
    handled_at = now(), updated_at = now() where id = request_row.id;
  return pg_catalog.jsonb_build_object('status', 'approved', 'membership_id', member_id);
end;
$$;

create function public.create_enterprise_join_request(target_enterprise_id uuid, target_message text)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
  request_row public.enterprise_join_requests%rowtype;
begin
  if actor_id is null then raise exception 'permission_denied'; end if;
  if char_length(coalesce(target_message,'')) > 500 then
    raise exception using errcode = '22023', message = 'invalid_join_request';
  end if;
  if not exists (select 1 from public.enterprises where id = target_enterprise_id and status = 'active') then
    raise exception 'enterprise_not_found';
  end if;
  if exists (select 1 from public.enterprise_memberships where tenant_id = target_enterprise_id and user_id = actor_id and status = 'active') then
    raise exception 'already_active_member';
  end if;
  select * into request_row from public.enterprise_join_requests
   where enterprise_id = target_enterprise_id and user_id = actor_id for update;
  if found and request_row.status = 'pending' then raise exception 'join_request_pending'; end if;
  insert into public.enterprise_join_requests(enterprise_id,user_id,status,requested_role_code,message,handled_by,handled_at)
  values (target_enterprise_id,actor_id,'pending','worker',nullif(btrim(target_message),''),null,null)
  on conflict (enterprise_id,user_id) do update set status = 'pending', requested_role_code = 'worker',
    message = excluded.message, handled_by = null, handled_at = null, updated_at = now()
  returning * into request_row;
  return pg_catalog.to_jsonb(request_row);
end;
$$;

create function public.list_enterprise_join_requests(target_enterprise_id uuid, target_status text)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog as $$
declare
  actor_id uuid := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  );
  result jsonb;
begin
  if actor_id is null then raise exception 'permission_denied'; end if;
  if target_status not in ('pending','approved','rejected','cancelled','all') then
    raise exception using errcode = '22023', message = 'invalid_join_request_status';
  end if;
  if target_enterprise_id is not null and not app_private.has_enterprise_permission(target_enterprise_id,'members.manage') then
    raise exception 'permission_denied';
  end if;
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object(
      'enterprise', pg_catalog.jsonb_build_object('id',enterprise.id,'name',enterprise.name,'enterprise_type',enterprise.enterprise_type,'status',enterprise.status),
      'name', profile.display_name,
      'phone', profile.phone,
      'role', request_row.requested_role_code,
      'request_type', 'employee_apply',
      'user', pg_catalog.jsonb_build_object('id',profile.id,'real_name',profile.display_name,'nickname',profile.display_name,'phone',profile.phone)
    ) order by request_row.created_at desc
  ), '[]'::jsonb) into result
  from public.enterprise_join_requests request_row
  join public.enterprises enterprise on enterprise.id = request_row.enterprise_id
  left join public.profiles profile on profile.id = request_row.user_id
  where (target_enterprise_id is null and request_row.user_id = actor_id
      or target_enterprise_id is not null and request_row.enterprise_id = target_enterprise_id)
    and (target_status = 'all' or request_row.status = target_status);
  return result;
end;
$$;

alter function public.register_recovery_proof(text, timestamptz) owner to v2_function_owner;
alter function public.consume_recovery_proof(text) owner to v2_function_owner;
alter function public.register_recovery_flow(text, text, timestamptz) owner to v2_function_owner;
alter function public.consume_recovery_flow(text, text) owner to v2_function_owner;
alter function public.update_enterprise_member(uuid, uuid, text, text, uuid) owner to v2_function_owner;
alter function public.remove_enterprise_member(uuid, uuid) owner to v2_function_owner;
alter function public.replace_employee_role_bindings(uuid, uuid, uuid[]) owner to v2_function_owner;
alter function public.save_employee_with_relations(uuid, uuid, uuid, jsonb, uuid[], uuid, uuid[]) owner to v2_function_owner;
alter function public.delete_employee_with_access(uuid, uuid, boolean) owner to v2_function_owner;
alter function public.handle_enterprise_join_request(uuid, text, text) owner to v2_function_owner;
alter function public.create_enterprise_join_request(uuid, text) owner to v2_function_owner;
alter function public.list_enterprise_join_requests(uuid, text) owner to v2_function_owner;
alter function app_private.actor_is_enterprise_owner(uuid) owner to v2_function_owner;
alter function app_private.membership_is_enterprise_owner(uuid, uuid) owner to v2_function_owner;
alter function app_private.active_enterprise_owner_count(uuid) owner to v2_function_owner;
alter function app_private.actor_can_assign_role(uuid, uuid) owner to v2_function_owner;

revoke all on function app_private.actor_is_enterprise_owner(uuid) from public, anon, authenticated, service_role;
revoke all on function app_private.membership_is_enterprise_owner(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function app_private.active_enterprise_owner_count(uuid) from public, anon, authenticated, service_role;
revoke all on function app_private.actor_can_assign_role(uuid, uuid) from public, anon, authenticated, service_role;

revoke all on function public.register_recovery_proof(text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.consume_recovery_proof(text) from public, anon, authenticated, service_role;
revoke all on function public.register_recovery_flow(text, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.consume_recovery_flow(text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_enterprise_member(uuid, uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.remove_enterprise_member(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.replace_employee_role_bindings(uuid, uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.save_employee_with_relations(uuid, uuid, uuid, jsonb, uuid[], uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.delete_employee_with_access(uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.handle_enterprise_join_request(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.create_enterprise_join_request(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.list_enterprise_join_requests(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.register_recovery_proof(text, timestamptz) to authenticated;
grant execute on function public.consume_recovery_proof(text) to authenticated;
grant execute on function public.register_recovery_flow(text, text, timestamptz) to service_role;
grant execute on function public.consume_recovery_flow(text, text) to service_role;
grant execute on function public.update_enterprise_member(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.remove_enterprise_member(uuid, uuid) to authenticated;
grant execute on function public.replace_employee_role_bindings(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.save_employee_with_relations(uuid, uuid, uuid, jsonb, uuid[], uuid, uuid[]) to authenticated;
grant execute on function public.delete_employee_with_access(uuid, uuid, boolean) to authenticated;
grant execute on function public.handle_enterprise_join_request(uuid, text, text) to authenticated;
grant execute on function public.create_enterprise_join_request(uuid, text) to authenticated;
grant execute on function public.list_enterprise_join_requests(uuid, text) to authenticated;

revoke create on schema public from v2_function_owner;

alter group v2_function_owner drop user postgres;
