-- enterprise_memberships.status is an enum. Keep the validated text API input,
-- but cast it before COALESCE and assignment so PostgreSQL never has to resolve
-- text and membership_status as a common type at runtime.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;

create or replace function public.update_enterprise_member(
  target_enterprise_id uuid,
  target_user_id uuid,
  target_display_name text,
  target_status text,
  target_role_id uuid
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
  member public.enterprise_memberships%rowtype;
  target_is_owner boolean;
  new_role_is_owner boolean := false;
  resulting_status public.membership_status;
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
  resulting_status := coalesce(target_status::public.membership_status, member.status);
  if target_is_owner and (resulting_status <> 'active' or (target_role_id is not null and not new_role_is_owner))
     and app_private.active_enterprise_owner_count(target_enterprise_id) <= 1 then raise exception 'last_owner_required'; end if;
  if actor_id = target_user_id and resulting_status <> 'active' then raise exception 'cannot_suspend_self'; end if;
  if member.status <> 'active' and resulting_status = 'active' and target_role_id is null then raise exception 'role_required'; end if;
  update public.enterprise_memberships
     set display_name = coalesce(btrim(target_display_name), display_name),
         status = coalesce(target_status::public.membership_status, status),
         updated_at = now()
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

revoke create on schema public from v2_function_owner;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'v2_function_owner') then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
