begin;

select plan(29);

select has_function('public', 'create_enterprise_role', array['uuid', 'text', 'text', 'text']);
select has_function('public', 'update_enterprise_role', array['uuid', 'uuid', 'text', 'text', 'text', 'boolean', 'boolean', 'boolean']);
select has_function('public', 'set_enterprise_role_permissions', array['uuid', 'uuid', 'text[]']);
select function_privs_are(
  'public', 'set_enterprise_role_permissions', array['uuid', 'uuid', 'text[]'], 'authenticated',
  array['EXECUTE'], 'authenticated callers may execute only the guarded permission RPC'
);
select function_privs_are(
  'public', 'set_enterprise_role_permissions', array['uuid', 'uuid', 'text[]'], 'anon',
  array[]::text[], 'anonymous callers cannot execute the role-permission RPC'
);
select ok(
  not has_table_privilege('authenticated', 'public.roles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.roles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.roles', 'DELETE')
  and not has_table_privilege('authenticated', 'public.role_permissions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.role_permissions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.role_permissions', 'DELETE'),
  'authenticated role management is RPC-only'
);

insert into public.enterprises(id, code, name, enterprise_type) values
  ('57000000-0000-4000-8000-000000000001', 'role-boundary-a', 'Role boundary A', 'manufacturer'),
  ('57000000-0000-4000-8000-000000000002', 'role-boundary-b', 'Role boundary B', 'dealer');

insert into auth.users(id, email, created_at, updated_at) values
  ('57000000-0000-4000-8000-000000000011', 'role-manager@example.invalid', now(), now()),
  ('57000000-0000-4000-8000-000000000012', 'role-owner@example.invalid', now(), now()),
  ('57000000-0000-4000-8000-000000000013', 'role-outsider@example.invalid', now(), now());

insert into public.enterprise_memberships(id, tenant_id, user_id, status, display_name) values
  ('57000000-0000-4000-8000-000000000101', '57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-000000000011', 'active', 'Role manager'),
  ('57000000-0000-4000-8000-000000000102', '57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-000000000012', 'active', 'Role owner'),
  ('57000000-0000-4000-8000-000000000103', '57000000-0000-4000-8000-000000000002', '57000000-0000-4000-8000-000000000013', 'active', 'Other tenant owner');

insert into public.roles(id, tenant_id, code, name, is_system) values
  ('57000000-0000-4000-8000-000000000201', '57000000-0000-4000-8000-000000000001', 'role_manager', 'Role manager', false),
  ('57000000-0000-4000-8000-000000000202', '57000000-0000-4000-8000-000000000001', 'enterprise_owner', 'Enterprise owner', true),
  ('57000000-0000-4000-8000-000000000203', '57000000-0000-4000-8000-000000000001', 'worker', 'Worker', true),
  ('57000000-0000-4000-8000-000000000204', '57000000-0000-4000-8000-000000000001', 'custom_role', 'Custom role', false),
  ('57000000-0000-4000-8000-000000000205', '57000000-0000-4000-8000-000000000002', 'enterprise_owner', 'Other owner', true);

insert into public.role_permissions(tenant_id, role_id, permission_code) values
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-000000000201', 'roles.manage'),
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-000000000201', 'members.read'),
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-000000000202', 'roles.manage'),
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-000000000202', 'members.manage'),
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-000000000202', 'finance.manage'),
  ('57000000-0000-4000-8000-000000000002', '57000000-0000-4000-8000-000000000205', 'roles.manage'),
  ('57000000-0000-4000-8000-000000000002', '57000000-0000-4000-8000-000000000205', 'members.manage');

insert into public.role_bindings(tenant_id, role_id, membership_id, scope_kind) values
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-000000000201', '57000000-0000-4000-8000-000000000101', 'enterprise'),
  ('57000000-0000-4000-8000-000000000001', '57000000-0000-4000-8000-000000000202', '57000000-0000-4000-8000-000000000102', 'enterprise'),
  ('57000000-0000-4000-8000-000000000002', '57000000-0000-4000-8000-000000000205', '57000000-0000-4000-8000-000000000103', 'enterprise');

select set_config('request.jwt.claim.sub', '57000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select lives_ok(
  $$select public.create_enterprise_role('57000000-0000-4000-8000-000000000001', 'sales_lead', 'Sales lead', null)$$,
  'an enterprise role manager may create a custom role'
);
select ok(
  exists (
    select 1 from public.roles
    where tenant_id = '57000000-0000-4000-8000-000000000001'
      and code = 'sales_lead' and not is_system
  ),
  'role creation cannot choose tenant or system-role ownership'
);
select throws_ok(
  $$select public.create_enterprise_role('57000000-0000-4000-8000-000000000002', 'intruder', 'Intruder', null)$$,
  'P0001', 'permission_denied', 'role creation rejects cross-tenant targets'
);
select throws_ok(
  $$select public.create_enterprise_role('57000000-0000-4000-8000-000000000001', 'finance', 'Fake finance system role', null)$$,
  'P0001', 'system_role_code_reserved', 'custom roles cannot claim a reserved system role code'
);
select lives_ok(
  $$select public.update_enterprise_role('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000204',null,'Updated custom role',null,false,true,true)$$,
  'a role manager may update custom role metadata'
);
select lives_ok(
  $$select public.update_enterprise_role('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000203',null,'Updated worker',null,false,true,false)$$,
  'system role display metadata remains editable under existing semantics'
);
select throws_ok(
  $$select public.update_enterprise_role('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000203','renamed_worker',null,null,true,false,false)$$,
  'P0001', 'system_role_code_protected', 'system role codes remain immutable'
);
select throws_ok(
  $$select public.update_enterprise_role('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000204','finance',null,null,true,false,false)$$,
  'P0001', 'system_role_code_reserved', 'custom roles cannot be renamed to a reserved system role code'
);
select lives_ok(
  $$select public.set_enterprise_role_permissions('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000204',array['roles.manage','members.read','roles.manage']::text[])$$,
  'a role manager may atomically assign a deduplicated subset of their grants'
);
select results_eq(
  $$select permission_code from public.role_permissions where tenant_id = '57000000-0000-4000-8000-000000000001' and role_id = '57000000-0000-4000-8000-000000000204' order by permission_code$$,
  $$values ('members.read'::text), ('roles.manage'::text)$$,
  'permission replacement stores the normalized requested set'
);
select throws_ok(
  $$select public.set_enterprise_role_permissions('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000201',array['roles.manage','members.read','finance.manage']::text[])$$,
  'P0001', 'permission_not_assignable', 'editing an assigned role cannot elevate the caller'
);
select results_eq(
  $$select permission_code from public.role_permissions where tenant_id = '57000000-0000-4000-8000-000000000001' and role_id = '57000000-0000-4000-8000-000000000201' order by permission_code$$,
  $$values ('members.read'::text), ('roles.manage'::text)$$,
  'a rejected self-elevation leaves the role permission set unchanged'
);
select throws_ok(
  $$select public.set_enterprise_role_permissions('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000204',array['not.a.permission']::text[])$$,
  '22023', 'invalid_permission_code', 'unknown permission codes are rejected before replacement'
);
select results_eq(
  $$select permission_code from public.role_permissions where tenant_id = '57000000-0000-4000-8000-000000000001' and role_id = '57000000-0000-4000-8000-000000000204' order by permission_code$$,
  $$values ('members.read'::text), ('roles.manage'::text)$$,
  'invalid permission input cannot partially clear an existing role'
);
select throws_ok(
  $$select public.update_enterprise_role('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000202',null,'Owner changed by manager',null,false,true,false)$$,
  'P0001', 'owner_protected', 'non-owners cannot edit enterprise-owner metadata'
);
select throws_ok(
  $$select public.set_enterprise_role_permissions('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000202',array['roles.manage','members.manage']::text[])$$,
  'P0001', 'owner_protected', 'non-owners cannot edit enterprise-owner permissions'
);

reset role;
select set_config('request.jwt.claim.sub', '57000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select throws_ok(
  $$select public.set_enterprise_role_permissions('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000202',array['roles.manage']::text[])$$,
  'P0001', 'owner_minimum_permissions_required', 'owner role must retain role and membership management'
);
select results_eq(
  $$select permission_code from public.role_permissions where tenant_id = '57000000-0000-4000-8000-000000000001' and role_id = '57000000-0000-4000-8000-000000000202' order by permission_code$$,
  $$values ('finance.manage'::text), ('members.manage'::text), ('roles.manage'::text)$$,
  'a rejected owner permission change is atomic'
);
select lives_ok(
  $$select public.set_enterprise_role_permissions('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000202',array['roles.manage','members.manage']::text[])$$,
  'an owner may change owner permissions while preserving the minimum set'
);
select lives_ok(
  $$select public.set_enterprise_role_permissions('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000202',array['roles.manage','members.manage','finance.manage']::text[])$$,
  'an owner may restore a catalog permission removed from their only role'
);
select results_eq(
  $$select permission_code from public.role_permissions where tenant_id = '57000000-0000-4000-8000-000000000001' and role_id = '57000000-0000-4000-8000-000000000202' order by permission_code$$,
  $$values ('finance.manage'::text), ('members.manage'::text), ('roles.manage'::text)$$,
  'owner recovery does not remain locked to the reduced effective grant set'
);
select lives_ok(
  $$select public.update_enterprise_role('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000202',null,'Primary owner',null,false,true,false)$$,
  'an owner may update enterprise-owner display metadata'
);

reset role;
select set_config('request.jwt.claim.sub', '57000000-0000-4000-8000-000000000013', true);
set local role authenticated;
select throws_ok(
  $$select public.set_enterprise_role_permissions('57000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000204',array[]::text[])$$,
  'P0001', 'permission_denied', 'a manager from another tenant cannot clear role permissions'
);

reset role;
select * from finish();
rollback;
