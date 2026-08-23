begin;

select plan(4);

select ok(
  not has_schema_privilege('v2_function_owner', 'auth', 'USAGE'),
  'the security-definer owner does not depend on auth schema access'
);

select ok(
  (select pg_catalog.pg_get_functiondef(target_function.oid)
   from pg_catalog.pg_proc target_function
   where target_function.oid = 'app_private.current_actor_id()'::regprocedure)
    like '%request.jwt.claim.sub%',
  'the owner identity helper resolves the JWT subject from session state'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc target_function
    join pg_catalog.pg_namespace namespace
      on namespace.oid = target_function.pronamespace
    where target_function.proowner = 'v2_function_owner'::regrole
      and namespace.nspname in ('public', 'app_private')
      and pg_catalog.strpos(
        pg_catalog.pg_get_functiondef(target_function.oid),
        'auth.uid()'
      ) > 0
  ),
  'owned security-definer functions have no direct auth schema dependency'
);

select ok(
  not has_table_privilege('v2_function_owner', 'auth.users', 'SELECT'),
  'the security-definer owner cannot read auth users directly'
);

select * from finish();

rollback;
