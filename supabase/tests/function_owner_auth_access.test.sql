begin;

select plan(4);

select ok(
  has_schema_privilege('v2_function_owner', 'auth', 'USAGE'),
  'the security-definer owner can resolve auth helpers'
);

select ok(
  has_function_privilege('v2_function_owner', 'auth.uid()', 'EXECUTE'),
  'the security-definer owner can identify the authenticated caller'
);

select ok(
  not has_schema_privilege('v2_function_owner', 'auth', 'CREATE'),
  'the security-definer owner cannot create objects in auth'
);

select ok(
  not has_table_privilege('v2_function_owner', 'auth.users', 'SELECT'),
  'the security-definer owner cannot read auth users directly'
);

select * from finish();

rollback;
