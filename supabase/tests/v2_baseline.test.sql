begin;

select plan(16);

select has_table('public', 'enterprises', 'enterprises table exists');
select has_table('public', 'enterprise_memberships', 'enterprise memberships table exists');
select has_table('public', 'sites', 'sites table exists');
select has_table('public', 'org_units', 'organization units table exists');
select has_table('public', 'workshops', 'workshops table exists');
select has_table('public', 'workstations', 'workstations table exists');
select has_table('public', 'permission_catalog', 'permission catalog table exists');
select has_table('public', 'roles', 'roles table exists');
select has_table('public', 'role_permissions', 'role permissions table exists');
select has_table('public', 'role_bindings', 'role bindings table exists');
select has_table('public', 'role_binding_sites', 'site role-binding scopes table exists');
select has_table('public', 'role_binding_workshops', 'workshop role-binding scopes table exists');
select has_table('public', 'api_idempotency_keys', 'API idempotency table exists');
select has_table('public', 'audit_events', 'audit events table exists');
select has_table('public', 'identity_action_requests', 'identity action requests table exists');
select has_table('app_private', 'security_events', 'private security events table exists');

select * from finish();

rollback;
