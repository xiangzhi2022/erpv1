begin;

select no_plan();

insert into public.enterprises (id, code, name, enterprise_type) values (
  '84000000-0000-4000-8000-000000000001',
  'workers-write-boundary',
  'Workers write boundary',
  'manufacturer'
);

insert into auth.users (id, email, created_at, updated_at) values
  ('84000000-0000-4000-8000-000000000011', 'workers-scoped@example.invalid', now(), now()),
  ('84000000-0000-4000-8000-000000000012', 'workers-enterprise@example.invalid', now(), now()),
  ('84000000-0000-4000-8000-000000000013', 'workers-linked@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('84000000-0000-4000-8000-000000000101', '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000011', 'active', 'Workshop manager'),
  ('84000000-0000-4000-8000-000000000102', '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000012', 'active', 'Enterprise manager'),
  ('84000000-0000-4000-8000-000000000103', '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000013', 'active', 'Linked worker');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('84000000-0000-4000-8000-000000000201', '84000000-0000-4000-8000-000000000001', 'workshop_worker_manager', 'Workshop worker manager', false),
  ('84000000-0000-4000-8000-000000000202', '84000000-0000-4000-8000-000000000001', 'enterprise_worker_manager', 'Enterprise worker manager', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000201', 'members.manage'),
  ('84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000202', 'members.manage');

insert into public.sites (id, tenant_id, code, name, site_type) values (
  '84000000-0000-4000-8000-000000000301',
  '84000000-0000-4000-8000-000000000001',
  'WORKERS-SITE',
  'Workers site',
  'factory'
);

insert into public.workshops (id, tenant_id, site_id, code, name) values
  ('84000000-0000-4000-8000-000000000401', '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000301', 'WORKERS-A', 'Workers A'),
  ('84000000-0000-4000-8000-000000000402', '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000301', 'WORKERS-B', 'Workers B');

insert into public.role_bindings (id, tenant_id, role_id, membership_id, scope_kind) values
  ('84000000-0000-4000-8000-000000000501', '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000201', '84000000-0000-4000-8000-000000000101', 'workshops'),
  ('84000000-0000-4000-8000-000000000502', '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000202', '84000000-0000-4000-8000-000000000102', 'enterprise');

insert into public.role_binding_workshops (tenant_id, binding_id, workshop_id) values (
  '84000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000501',
  '84000000-0000-4000-8000-000000000401'
);

insert into public.workers (
  id, enterprise_id, user_id, worker_no, name, workshop_id
) values
  ('84000000-0000-4000-8000-000000000601', '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000013', 'BOUNDARY-A', 'Boundary A', '84000000-0000-4000-8000-000000000401'),
  ('84000000-0000-4000-8000-000000000602', '84000000-0000-4000-8000-000000000001', null, 'BOUNDARY-B', 'Boundary B', '84000000-0000-4000-8000-000000000402'),
  ('84000000-0000-4000-8000-000000000603', '84000000-0000-4000-8000-000000000001', null, 'BOUNDARY-NULL', 'Boundary unassigned', null);

select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select lives_ok(
  $$insert into public.workers (enterprise_id, worker_no, name, workshop_id)
    values ('84000000-0000-4000-8000-000000000001', 'SCOPED-INSERT-A', 'Scoped insert A', '84000000-0000-4000-8000-000000000401')$$,
  'workshop A manager can insert a workshop A worker'
);

select is(
  (
    select created_by
    from public.workers
    where enterprise_id = '84000000-0000-4000-8000-000000000001'
      and worker_no = 'SCOPED-INSERT-A'
  ),
  '84000000-0000-4000-8000-000000000011'::uuid,
  'worker creation records the authenticated actor without accepting created_by input'
);

select throws_ok(
  $$insert into public.workers (enterprise_id, worker_no, name, workshop_id)
    values ('84000000-0000-4000-8000-000000000001', 'SCOPED-INSERT-B', 'Scoped insert B', '84000000-0000-4000-8000-000000000402')$$,
  '42501',
  'new row violates row-level security policy for table "workers"',
  'workshop A manager cannot insert a workshop B worker'
);

select throws_ok(
  $$insert into public.workers (enterprise_id, worker_no, name, workshop_id)
    values ('84000000-0000-4000-8000-000000000001', 'SCOPED-INSERT-NULL', 'Scoped insert unassigned', null)$$,
  '42501',
  'new row violates row-level security policy for table "workers"',
  'workshop A manager cannot insert an unassigned worker'
);

select throws_ok(
  $$update public.workers
    set workshop_id = '84000000-0000-4000-8000-000000000402'
    where id = '84000000-0000-4000-8000-000000000601'$$,
  '42501',
  'new row violates row-level security policy for table "workers"',
  'workshop A manager cannot move a worker to workshop B'
);

select throws_ok(
  $$update public.workers
    set user_id = '84000000-0000-4000-8000-000000000011'
    where id = '84000000-0000-4000-8000-000000000601'$$,
  '42501',
  'permission denied for table workers',
  'workshop A manager cannot update worker identity linkage'
);

select is_empty(
  $$delete from public.workers
    where id = '84000000-0000-4000-8000-000000000602'
    returning id$$,
  'workshop A manager cannot delete a workshop B worker'
);

reset role;
select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select lives_ok(
  $$insert into public.workers (enterprise_id, worker_no, name, workshop_id)
    values
      ('84000000-0000-4000-8000-000000000001', 'ENTERPRISE-INSERT-NULL', 'Enterprise insert null', null),
      ('84000000-0000-4000-8000-000000000001', 'ENTERPRISE-INSERT-B', 'Enterprise insert B', '84000000-0000-4000-8000-000000000402')$$,
  'enterprise manager can manage unassigned and workshop workers'
);

select set_eq(
  $$update public.workers
    set workshop_id = '84000000-0000-4000-8000-000000000401'
    where worker_no = 'ENTERPRISE-INSERT-B'
    returning workshop_id$$,
  $$values ('84000000-0000-4000-8000-000000000401'::uuid)$$,
  'enterprise manager can move workers between workshops'
);

select set_eq(
  $$delete from public.workers
    where worker_no in ('ENTERPRISE-INSERT-NULL', 'ENTERPRISE-INSERT-B')
    returning worker_no$$,
  $$values ('ENTERPRISE-INSERT-NULL'::text), ('ENTERPRISE-INSERT-B'::text)$$,
  'enterprise manager can delete unassigned and workshop workers'
);

reset role;

select * from finish();
rollback;
