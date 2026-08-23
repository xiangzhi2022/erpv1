begin;

select plan(67);

select has_function('public', 'register_recovery_proof', array['text', 'timestamp with time zone']);
select has_function('public', 'consume_recovery_proof', array['text']);
select has_function('public', 'update_enterprise_member', array['uuid', 'uuid', 'text', 'text', 'uuid']);
select has_function('public', 'remove_enterprise_member', array['uuid', 'uuid']);
select has_function('public', 'handle_enterprise_join_request', array['uuid', 'text', 'text']);
select has_function('public', 'replace_employee_role_bindings', array['uuid', 'uuid', 'uuid[]']);
select has_function('public', 'register_recovery_flow', array['text', 'text', 'timestamp with time zone']);
select has_function('public', 'consume_recovery_flow', array['text', 'text']);
select has_function('public', 'save_employee_with_relations', array['uuid', 'uuid', 'uuid', 'jsonb', 'uuid[]', 'uuid', 'uuid[]']);
select has_function('public', 'delete_employee_with_access', array['uuid', 'uuid', 'boolean']);
select has_function('public', 'create_enterprise_join_request', array['uuid', 'text']);
select has_function('public', 'list_enterprise_join_requests', array['uuid', 'text']);
select function_privs_are(
  'public', 'handle_enterprise_join_request', array['uuid', 'text', 'text'], 'authenticated',
  array['EXECUTE'], 'authenticated may execute the guarded join-request RPC'
);
select function_privs_are(
  'public', 'register_recovery_flow', array['text', 'text', 'timestamp with time zone'], 'anon',
  array[]::text[], 'anonymous Data API callers cannot grow the recovery-flow table directly'
);
select function_privs_are(
  'public', 'consume_recovery_flow', array['text', 'text'], 'authenticated',
  array[]::text[], 'authenticated callers cannot consume a recovery callback flow directly'
);
select function_privs_are(
  'public', 'update_enterprise_member', array['uuid', 'uuid', 'text', 'text', 'uuid'], 'anon',
  array[]::text[], 'anonymous callers cannot update tenant membership'
);
select ok(
  not has_table_privilege('authenticated', 'public.employees', 'INSERT')
  and not has_table_privilege('authenticated', 'public.employees', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.employees', 'DELETE')
  and not has_table_privilege('authenticated', 'public.employee_positions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.employee_positions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.employee_positions', 'DELETE')
  and not has_table_privilege('authenticated', 'public.employee_roles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.employee_roles', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.employee_roles', 'DELETE'),
  'employee and relation writes are RPC-only for authenticated callers'
);

insert into public.enterprises(id, code, name, enterprise_type) values
  ('51000000-0000-4000-8000-000000000001', 'identity-boundary-a', 'Identity A', 'manufacturer'),
  ('52000000-0000-4000-8000-000000000002', 'identity-boundary-b', 'Identity B', 'dealer');

insert into auth.users(id, email, created_at, updated_at) values
  ('51000000-0000-4000-8000-000000000011', 'manager-a@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000012', 'ordinary-a@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000013', 'high-request@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000014', 'replacement-a@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000015', 'applicant-a@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000016', 'owner-a@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000017', 'second-owner-a@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000018', 'reapprove-a@example.invalid', now(), now()),
  ('52000000-0000-4000-8000-000000000021', 'member-b@example.invalid', now(), now());

insert into public.enterprise_memberships(id, tenant_id, user_id, status, display_name) values
  ('51000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000011', 'active', 'Manager A'),
  ('51000000-0000-4000-8000-000000000102', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000012', 'active', 'Ordinary A'),
  ('51000000-0000-4000-8000-000000000103', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000014', 'active', 'Replacement A'),
  ('51000000-0000-4000-8000-000000000104', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000016', 'active', 'Owner A'),
  ('51000000-0000-4000-8000-000000000105', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000017', 'active', 'Second owner candidate'),
  ('51000000-0000-4000-8000-000000000106', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000018', 'suspended', 'Reapprove A'),
  ('52000000-0000-4000-8000-000000000121', '52000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000021', 'active', 'Member B');

insert into public.roles(id, tenant_id, code, name, is_system) values
  ('51000000-0000-4000-8000-000000000201', '51000000-0000-4000-8000-000000000001', 'identity_manager', 'Identity manager', false),
  ('51000000-0000-4000-8000-000000000202', '51000000-0000-4000-8000-000000000001', 'worker', 'Worker', true),
  ('51000000-0000-4000-8000-000000000203', '51000000-0000-4000-8000-000000000001', 'enterprise_owner', 'Enterprise owner', true),
  ('51000000-0000-4000-8000-000000000204', '51000000-0000-4000-8000-000000000001', 'finance_power', 'Finance power', false);
insert into public.role_permissions(tenant_id, role_id, permission_code) values
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000201', 'members.manage'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000201', 'roles.manage');
insert into public.role_permissions(tenant_id, role_id, permission_code) values
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000203', 'members.manage'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000203', 'roles.manage'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000203', 'finance.manage'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000204', 'finance.manage');
insert into public.role_bindings(tenant_id, role_id, membership_id, scope_kind) values
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000201', '51000000-0000-4000-8000-000000000101', 'enterprise'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000202', '51000000-0000-4000-8000-000000000102', 'enterprise'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000202', '51000000-0000-4000-8000-000000000102', 'self'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000203', '51000000-0000-4000-8000-000000000104', 'enterprise'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000202', '51000000-0000-4000-8000-000000000105', 'enterprise');
insert into public.positions(id,enterprise_id,name,code,status) values
  ('51000000-0000-4000-8000-000000000401','51000000-0000-4000-8000-000000000001','Assembler','assembler','active');
insert into public.sites(id,tenant_id,code,name,site_type,status) values
  ('51000000-0000-4000-8000-000000000601','51000000-0000-4000-8000-000000000001','identity-site','Identity site','factory','active');
insert into public.workshops(id,tenant_id,site_id,code,name) values
  ('51000000-0000-4000-8000-000000000602','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000601','identity-workshop','Identity workshop');
insert into public.role_bindings(id,tenant_id,role_id,membership_id,scope_kind) values
  ('51000000-0000-4000-8000-000000000701','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000204','51000000-0000-4000-8000-000000000106','sites'),
  ('51000000-0000-4000-8000-000000000702','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000204','51000000-0000-4000-8000-000000000106','workshops');
insert into public.role_binding_sites(tenant_id,binding_id,site_id) values
  ('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000701','51000000-0000-4000-8000-000000000601');
insert into public.role_binding_workshops(tenant_id,binding_id,workshop_id) values
  ('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000702','51000000-0000-4000-8000-000000000602');
insert into public.employees(id,enterprise_id,user_id,employee_no,name,status,base_salary) values
  ('51000000-0000-4000-8000-000000000501','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000012','E-IDENTITY-1','Original Employee','active',4200),
  ('51000000-0000-4000-8000-000000000502','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000016','E-OWNER-1','Owner Employee','active',0),
  ('51000000-0000-4000-8000-000000000503','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000018','E-REAPPROVE-1','Old Privileged Employee','inactive',0);
insert into public.employee_roles(enterprise_id,employee_id,role_id) values
  ('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000501','51000000-0000-4000-8000-000000000202'),
  ('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000502','51000000-0000-4000-8000-000000000203'),
  ('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000503','51000000-0000-4000-8000-000000000204');
insert into public.enterprise_join_requests(id, enterprise_id, user_id, status, requested_role_code) values
  ('51000000-0000-4000-8000-000000000301', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000013', 'pending', 'enterprise_owner'),
  ('51000000-0000-4000-8000-000000000302', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000018', 'pending', 'worker'),
  ('51000000-0000-4000-8000-000000000303', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000016', 'pending', 'worker');

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select throws_ok(
  $$select public.update_enterprise_member('52000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000021', 'Taken over', 'active', null)$$,
  'P0001', 'permission_denied', 'ordinary members cannot update cross-tenant membership'
);

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000012',null,'active','51000000-0000-4000-8000-000000000203')$$,
  'P0001','role_not_assignable','enterprise admins cannot promote another member to enterprise owner'
);
select throws_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000011',null,'active','51000000-0000-4000-8000-000000000203')$$,
  'P0001','role_not_assignable','enterprise admins cannot promote themselves to enterprise owner'
);
select throws_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000012',null,'active','51000000-0000-4000-8000-000000000204')$$,
  'P0001','role_not_assignable','assigned role permissions must be a subset of actor enterprise grants'
);
select throws_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000016','Changed by admin',null,null)$$,
  'P0001','owner_protected','non-owners cannot modify an enterprise owner'
);
select throws_ok(
  $$select public.remove_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000016')$$,
  'P0001','owner_protected','non-owners cannot remove an enterprise owner'
);
select throws_ok(
  $$select public.delete_employee_with_access('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000502',true)$$,
  'P0001','owner_protected','employee deletion cannot bypass owner protection'
);
select throws_ok(
  $$select public.replace_employee_role_bindings('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000016',array['51000000-0000-4000-8000-000000000202']::uuid[])$$,
  'P0001','owner_protected','direct role replacement cannot modify an owner as a non-owner'
);
select throws_ok(
  $$select public.save_employee_with_relations('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000502','51000000-0000-4000-8000-000000000016','{}'::jsonb,array[]::uuid[],null,array['51000000-0000-4000-8000-000000000202']::uuid[])$$,
  'P0001','owner_protected','employee role synchronization cannot downgrade an owner as a non-owner'
);
insert into public.employee_roles(enterprise_id,employee_id,role_id) values
  ('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000501','51000000-0000-4000-8000-000000000204');
select lives_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000012',null,'active','51000000-0000-4000-8000-000000000202')$$,
  'membership role replacement also synchronizes the linked employee role'
);
select ok(
  (select count(*) = 1 from public.employee_roles where employee_id = '51000000-0000-4000-8000-000000000501')
  and exists (select 1 from public.employee_roles where employee_id = '51000000-0000-4000-8000-000000000501' and role_id = '51000000-0000-4000-8000-000000000202'),
  'linked employee roles cannot retain stale access metadata after a settings role change'
);
select throws_ok(
  $$select public.save_employee_with_relations('51000000-0000-4000-8000-000000000001',null,null,'{"employee_no":"E-UNLINKED-POWER","name":"Unlinked power"}'::jsonb,array[]::uuid[],null,array['51000000-0000-4000-8000-000000000204']::uuid[])$$,
  'P0001','role_not_assignable','employee role rows cannot bypass the actor permission subset when no login user is linked'
);
select throws_ok(
  $$select public.save_employee_with_relations('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000501','51000000-0000-4000-8000-000000000012','{"base_salary":10000}'::jsonb,array[]::uuid[],null,array['51000000-0000-4000-8000-000000000202']::uuid[])$$,
  'P0001','wage_permission_denied','members and role managers cannot change base salary without enterprise wages.manage'
);
select ok(
  not (public.save_employee_with_relations(
    '51000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000501',
    '51000000-0000-4000-8000-000000000012',
    '{}'::jsonb,
    array[]::uuid[],
    null,
    array['51000000-0000-4000-8000-000000000202']::uuid[]
  ) ? 'base_salary'),
  'members manager cannot recover base salary from the employee mutation result'
);

select throws_ok(
  $$select public.save_employee_with_relations('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000501','51000000-0000-4000-8000-000000000014','{"name":"Must Roll Back"}'::jsonb,array[]::uuid[],'51000000-0000-4000-8000-000000000401',array['51000000-0000-4000-8000-000000000202']::uuid[])$$,
  '22023', 'primary_position_not_assigned', 'invalid relation input aborts the entire employee transaction'
);
select results_eq(
  $$select name from public.employees where id = '51000000-0000-4000-8000-000000000501'$$,
  $$values ('Original Employee'::text)$$,
  'failed relation validation leaves employee fields unchanged'
);
insert into public.role_bindings(id,tenant_id,role_id,membership_id,scope_kind) values
  ('51000000-0000-4000-8000-000000000703','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000204','51000000-0000-4000-8000-000000000103','self');
select lives_ok(
  $$select public.save_employee_with_relations('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000501','51000000-0000-4000-8000-000000000014','{}'::jsonb,array['51000000-0000-4000-8000-000000000401']::uuid[],'51000000-0000-4000-8000-000000000401',array['51000000-0000-4000-8000-000000000202']::uuid[])$$,
  'employee user and all relations change atomically'
);
select is(
  (select count(*) from public.role_bindings where tenant_id = '51000000-0000-4000-8000-000000000001' and membership_id = '51000000-0000-4000-8000-000000000102'),
  0::bigint,
  'changing employee user revokes every old-user binding scope'
);
select ok(
  exists (select 1 from public.role_bindings where membership_id = '51000000-0000-4000-8000-000000000103' and role_id = '51000000-0000-4000-8000-000000000202' and scope_kind = 'enterprise')
  and (select count(*) = 1 from public.role_bindings where membership_id = '51000000-0000-4000-8000-000000000103')
  and exists (select 1 from public.employee_positions where employee_id = '51000000-0000-4000-8000-000000000501' and position_id = '51000000-0000-4000-8000-000000000401' and is_primary)
  and exists (select 1 from public.employee_roles where employee_id = '51000000-0000-4000-8000-000000000501' and role_id = '51000000-0000-4000-8000-000000000202'),
  'the new active user receives the preserved employee role and position relationships'
);
insert into public.role_bindings(tenant_id,role_id,membership_id,scope_kind) values
  ('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000202','51000000-0000-4000-8000-000000000103','self');
select lives_ok(
  $$select public.delete_employee_with_access('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000501',false)$$,
  'soft-deactivating an employee uses the atomic access revocation path'
);
select ok(
  (select status = 'inactive' from public.employees where id = '51000000-0000-4000-8000-000000000501')
  and not exists (select 1 from public.role_bindings where membership_id = '51000000-0000-4000-8000-000000000103'),
  'deactivation removes enterprise and scoped bindings before returning'
);
reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000016', true);
set local role authenticated;
select throws_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000016',null,'active','51000000-0000-4000-8000-000000000202')$$,
  'P0001','last_owner_required','the final active owner cannot be downgraded'
);
select throws_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000016',null,'suspended',null)$$,
  'P0001','last_owner_required','the final active owner cannot be suspended'
);
select throws_ok(
  $$select public.remove_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000016')$$,
  'P0001','cannot_remove_self','the final active owner cannot delete their own membership'
);
select lives_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000017',null,'active','51000000-0000-4000-8000-000000000203')$$,
  'an owner may promote a second owner when role permissions are within their grants'
);
select lives_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000017',null,'suspended',null)$$,
  'an owner may suspend another owner while one active owner remains'
);
reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000012', true);
set local role authenticated;
select throws_ok(
  $$select public.replace_employee_role_bindings('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000012', array['51000000-0000-4000-8000-000000000202']::uuid[])$$,
  'P0001', 'permission_denied', 'ordinary members cannot replace role bindings'
);
select throws_ok(
  $$select public.handle_enterprise_join_request('51000000-0000-4000-8000-000000000301', 'approve', null)$$,
  'P0001', 'permission_denied', 'ordinary members cannot approve join requests'
);

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$select public.update_enterprise_member('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000011', null, 'suspended', null)$$,
  'P0001', 'cannot_suspend_self', 'an administrator cannot suspend their own membership'
);
select throws_ok(
  $$select public.remove_enterprise_member('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000011')$$,
  'P0001', 'cannot_remove_self', 'an administrator cannot remove their own membership'
);
select throws_ok(
  $$select public.handle_enterprise_join_request('51000000-0000-4000-8000-000000000302', null, null)$$,
  '22023', 'invalid_join_request_action', 'a null join-request action is rejected instead of being treated as approval'
);
select is(
  (select status from public.enterprise_join_requests where id = '51000000-0000-4000-8000-000000000302'),
  'pending'::text,
  'a rejected null action leaves the join request pending'
);
select throws_ok(
  $$select public.handle_enterprise_join_request('51000000-0000-4000-8000-000000000301', 'approve', null)$$,
  'P0001', 'requested_role_not_allowed', 'approval independently rejects privileged requested roles'
);
select throws_ok(
  $$select public.handle_enterprise_join_request('51000000-0000-4000-8000-000000000303','approve',null)$$,
  'P0001','already_active_member','stale join requests cannot downgrade an active owner or member'
);
select lives_ok(
  $$select public.handle_enterprise_join_request('51000000-0000-4000-8000-000000000302','approve',null)$$,
  'reapproving a suspended member succeeds through the atomic worker path'
);
select ok(
  exists (select 1 from public.enterprise_memberships where id = '51000000-0000-4000-8000-000000000106' and status = 'active')
  and (select count(*) = 1 from public.role_bindings where membership_id = '51000000-0000-4000-8000-000000000106' and role_id = '51000000-0000-4000-8000-000000000202' and scope_kind = 'enterprise')
  and not exists (select 1 from public.role_binding_sites where binding_id = '51000000-0000-4000-8000-000000000701')
  and not exists (select 1 from public.role_binding_workshops where binding_id = '51000000-0000-4000-8000-000000000702')
  and (select count(*) = 1 from public.employee_roles where employee_id = '51000000-0000-4000-8000-000000000503' and role_id = '51000000-0000-4000-8000-000000000202'),
  'reapproval removes stale site/workshop bindings and replaces employee roles with worker'
);

reset role;
select ok(
  not exists (select 1 from public.enterprise_memberships where tenant_id = '51000000-0000-4000-8000-000000000001' and user_id = '51000000-0000-4000-8000-000000000013')
  and not exists (select 1 from public.employees where enterprise_id = '51000000-0000-4000-8000-000000000001' and user_id = '51000000-0000-4000-8000-000000000013')
  and not exists (select 1 from public.role_bindings binding join public.enterprise_memberships membership on membership.id = binding.membership_id where membership.user_id = '51000000-0000-4000-8000-000000000013'),
  'rejected privileged approval creates no membership, employee, or binding'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000015', true);
set local role authenticated;
select throws_ok(
  $$insert into public.enterprise_join_requests(enterprise_id,user_id,status,requested_role_code) values ('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000015','pending','enterprise_owner')$$,
  '42501', 'permission denied for table enterprise_join_requests',
  'authenticated callers cannot bypass join creation RPC with a privileged role'
);
select lives_ok(
  $$select public.create_enterprise_join_request('51000000-0000-4000-8000-000000000001','Please add me')$$,
  'an identity without membership can submit a worker join request'
);
select is(
  pg_catalog.jsonb_array_length(public.list_enterprise_join_requests(null,'pending')),
  1,
  'ordinary users list only their own pending requests'
);
select throws_ok(
  $$update public.enterprise_join_requests set requested_role_code = 'enterprise_owner' where user_id = '51000000-0000-4000-8000-000000000015'$$,
  '42501', 'permission denied for table enterprise_join_requests',
  'authenticated callers cannot mutate a pending request directly'
);

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000011', true);
set local role authenticated;
select ok(
  pg_catalog.jsonb_array_length(public.list_enterprise_join_requests('51000000-0000-4000-8000-000000000001','pending')) >= 2,
  'members.manage can list tenant pending requests'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000012', true);
set local role authenticated;
select lives_ok(
  $$select public.register_recovery_proof(repeat('a', 64), now() + interval '10 minutes')$$,
  'an authenticated user can register a bounded recovery nonce'
);

reset role;
select set_config('request.jwt.claim.sub', '52000000-0000-4000-8000-000000000021', true);
set local role authenticated;
select is(public.consume_recovery_proof(repeat('a', 64)), false, 'a different actor cannot consume the nonce');

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000012', true);
set local role authenticated;
select is(public.consume_recovery_proof(repeat('a', 64)), true, 'the owning actor consumes the unexpired nonce');
select is(public.consume_recovery_proof(repeat('a', 64)), false, 'the nonce cannot be replayed');

reset role;
insert into app_private.auth_recovery_proofs(user_id, nonce_hash, expires_at)
values ('51000000-0000-4000-8000-000000000012', repeat('b', 64), now() - interval '1 second');
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000012', true);
set local role authenticated;
select is(public.consume_recovery_proof(repeat('b', 64)), false, 'expired nonces cannot be consumed');

reset role;
set local role service_role;
select lives_ok(
  $$select public.register_recovery_flow(repeat('c',64),repeat('d',64),now() + interval '10 minutes')$$,
  'the protected server client can register a bounded opaque flow nonce'
);
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000012', true);
select is(public.consume_recovery_flow(repeat('c',64),repeat('d',64)), true, 'a verified callback consumes its recovery flow once');
select is(public.consume_recovery_flow(repeat('c',64),repeat('d',64)), false, 'a recovery flow cannot be replayed');

reset role;
select * from finish();
rollback;
