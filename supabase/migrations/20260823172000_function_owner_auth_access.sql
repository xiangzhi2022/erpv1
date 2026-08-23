-- Supabase owns and may re-apply the auth schema ACL. Security-definer
-- functions therefore resolve the JWT subject without depending on auth schema
-- privileges, while RLS policies invoked by API roles keep using auth.uid().
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_roles where rolname = 'v2_function_owner'
  ) then
    execute 'alter group v2_function_owner add user postgres';
  end if;
end;
$$;

grant create on schema public to v2_function_owner;

create or replace function app_private.current_actor_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
return nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

alter function app_private.current_actor_id() owner to v2_function_owner;

revoke all on function app_private.current_actor_id()
  from public, anon, authenticated, service_role;

do $$
declare
  owned_function record;
begin
  for owned_function in
    select target_function.oid
    from pg_catalog.pg_proc target_function
    join pg_catalog.pg_namespace namespace
      on namespace.oid = target_function.pronamespace
    where target_function.proowner = 'v2_function_owner'::regrole
      and namespace.nspname in ('public', 'app_private')
      and pg_catalog.strpos(
        pg_catalog.pg_get_functiondef(target_function.oid),
        'auth.uid()'
      ) > 0
  loop
    execute pg_catalog.replace(
      pg_catalog.pg_get_functiondef(owned_function.oid),
      'auth.uid()',
      'app_private.current_actor_id()'
    );
  end loop;
end;
$$;

revoke create on schema public from v2_function_owner;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_auth_members membership
    where membership.roleid = 'v2_function_owner'::regrole
      and membership.member = 'postgres'::regrole
  ) then
    execute 'alter group v2_function_owner drop user postgres';
  end if;
end;
$$;
