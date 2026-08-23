begin;

select no_plan();

insert into public.enterprises (id, code, name, enterprise_type) values (
  '73000000-0000-4000-8000-000000000001',
  'production-read-scope',
  'Production read scope',
  'manufacturer'
);

insert into auth.users (id, email, created_at, updated_at) values
  ('73000000-0000-4000-8000-000000000011', 'production-reader@example.invalid', now(), now()),
  ('73000000-0000-4000-8000-000000000012', 'production-other@example.invalid', now(), now());

insert into public.enterprise_memberships (
  id, tenant_id, user_id, status, display_name
) values (
  '73000000-0000-4000-8000-000000000101',
  '73000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000011',
  'active',
  'Workshop A reader'
);

insert into public.roles (id, tenant_id, code, name, is_system) values (
  '73000000-0000-4000-8000-000000000201',
  '73000000-0000-4000-8000-000000000001',
  'production_reader_a',
  'Production reader A',
  false
);

insert into public.role_permissions (tenant_id, role_id, permission_code) values (
  '73000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000201',
  'production.read'
);

insert into public.sites (id, tenant_id, code, name, site_type) values (
  '73000000-0000-4000-8000-000000000301',
  '73000000-0000-4000-8000-000000000001',
  'PRODUCTION-SITE',
  'Production site',
  'factory'
);

insert into public.workshops (id, tenant_id, site_id, code, name) values
  (
    '73000000-0000-4000-8000-000000000401',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000301',
    'WORKSHOP-A',
    'Workshop A'
  ),
  (
    '73000000-0000-4000-8000-000000000402',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000301',
    'WORKSHOP-B',
    'Workshop B'
  );

insert into public.role_bindings (
  id, tenant_id, role_id, membership_id, scope_kind
) values (
  '73000000-0000-4000-8000-000000000501',
  '73000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000201',
  '73000000-0000-4000-8000-000000000101',
  'workshops'
);

insert into public.role_binding_workshops (
  tenant_id, binding_id, workshop_id
) values (
  '73000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000501',
  '73000000-0000-4000-8000-000000000401'
);

insert into public.workers (
  id, enterprise_id, user_id, worker_no, name, workshop_id
) values
  (
    '73000000-0000-4000-8000-000000000601',
    '73000000-0000-4000-8000-000000000001',
    null,
    'WORKER-A',
    'Workshop A worker',
    '73000000-0000-4000-8000-000000000401'
  ),
  (
    '73000000-0000-4000-8000-000000000602',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000012',
    'WORKER-B',
    'Workshop B other worker',
    '73000000-0000-4000-8000-000000000402'
  ),
  (
    '73000000-0000-4000-8000-000000000603',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000011',
    'WORKER-SELF',
    'Own worker binding',
    '73000000-0000-4000-8000-000000000402'
  );

insert into public.work_orders (
  id, enterprise_id, workshop_id, product_name, target_quantity
) values
  (
    '73000000-0000-4000-8000-000000000701',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000401',
    'Scoped work order',
    1
  ),
  (
    '73000000-0000-4000-8000-000000000702',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000402',
    'Other workshop work order',
    1
  ),
  (
    '73000000-0000-4000-8000-000000000703',
    '73000000-0000-4000-8000-000000000001',
    null,
    'Unassigned work order',
    1
  );

insert into public.progress_logs (
  id, enterprise_id, work_order_id, action
) values
  (
    '73000000-0000-4000-8000-000000000801',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000701',
    'start-a'
  ),
  (
    '73000000-0000-4000-8000-000000000802',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000702',
    'start-b'
  ),
  (
    '73000000-0000-4000-8000-000000000803',
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000703',
    'start-unassigned'
  );

select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select results_eq(
  $$
    select product_name
    from public.work_orders
    where enterprise_id = '73000000-0000-4000-8000-000000000001'
    order by product_name
  $$,
  $$values ('Scoped work order')$$,
  'workshop A production reader sees only workshop A work orders'
);

select is_empty(
  $$
    select id
    from public.work_orders
    where enterprise_id = '73000000-0000-4000-8000-000000000001'
      and workshop_id is null
  $$,
  'workshop A production reader cannot see unassigned work orders'
);

select results_eq(
  $$
    select action
    from public.progress_logs
    where enterprise_id = '73000000-0000-4000-8000-000000000001'
    order by action
  $$,
  $$values ('start-a')$$,
  'workshop A production reader sees only workshop A progress logs'
);

select results_eq(
  $$
    select worker_no
    from public.workers
    where enterprise_id = '73000000-0000-4000-8000-000000000001'
    order by worker_no
  $$,
  $$values ('WORKER-A'), ('WORKER-SELF')$$,
  'workshop A production reader sees workshop A workers and their own worker binding'
);

select is_empty(
  $$
    select id
    from public.workers
    where enterprise_id = '73000000-0000-4000-8000-000000000001'
      and worker_no = 'WORKER-B'
  $$,
  'workshop A production reader cannot see another workshop B worker'
);

select * from finish();
rollback;
