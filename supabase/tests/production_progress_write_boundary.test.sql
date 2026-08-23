begin;

select no_plan();

select ok(
  not has_table_privilege('authenticated', 'public.progress_logs', 'INSERT')
  and not has_table_privilege('authenticated', 'public.progress_logs', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.progress_logs', 'DELETE'),
  'progress logs cannot be written directly by authenticated callers'
);

select ok(
  not has_table_privilege('authenticated', 'public.order_status_logs', 'INSERT')
  and not has_table_privilege('authenticated', 'public.order_status_logs', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.order_status_logs', 'DELETE'),
  'order status logs cannot be written directly by authenticated callers'
);

select ok(
  not has_column_privilege('authenticated', 'public.orders', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.order_spaces', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.order_products', 'status', 'UPDATE'),
  'order aggregate status columns are RPC-only'
);

select ok(
  not has_column_privilege('authenticated', 'public.order_spaces', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.order_products', 'status', 'INSERT'),
  'order component initial status is database-controlled'
);

select ok(
  not has_table_privilege('authenticated', 'public.production_tasks', 'INSERT')
  and not has_table_privilege('authenticated', 'public.production_tasks', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.production_tasks', 'DELETE')
  and not has_table_privilege('authenticated', 'public.work_orders', 'INSERT')
  and not has_table_privilege('authenticated', 'public.work_orders', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.work_orders', 'DELETE'),
  'production task and work-order writes are RPC-only'
);

insert into public.enterprises (id, code, name, enterprise_type)
values ('51000000-0000-4000-8000-000000000001', 'progress-boundary', 'Progress boundary', 'manufacturer');

insert into public.sites (id, tenant_id, code, name, site_type) values
  ('51000000-0000-4000-8000-000000000701', '51000000-0000-4000-8000-000000000001', 'SITE-1', 'Factory site', 'factory');

insert into public.workshops (id, tenant_id, site_id, code, name) values
  ('51000000-0000-4000-8000-000000000711', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000701', 'WS-1', 'Workshop one'),
  ('51000000-0000-4000-8000-000000000712', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000701', 'WS-2', 'Workshop two');

insert into auth.users (id, email, created_at, updated_at) values
  ('51000000-0000-4000-8000-000000000011', 'self-worker@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000012', 'other-worker@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000013', 'reviewer@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000014', 'warehouse@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000015', 'manager@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000016', 'order-editor@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000017', 'planner@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000018', 'scoped-planner@example.invalid', now(), now()),
  ('51000000-0000-4000-8000-000000000019', 'scoped-wage-manager@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('51000000-0000-4000-8000-000000000101', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000011', 'active', 'Self worker'),
  ('51000000-0000-4000-8000-000000000102', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000012', 'active', 'Other worker'),
  ('51000000-0000-4000-8000-000000000103', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000013', 'active', 'Reviewer'),
  ('51000000-0000-4000-8000-000000000104', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000014', 'active', 'Warehouse'),
  ('51000000-0000-4000-8000-000000000105', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000015', 'active', 'Manager'),
  ('51000000-0000-4000-8000-000000000106', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000016', 'active', 'Order editor'),
  ('51000000-0000-4000-8000-000000000107', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000017', 'active', 'Planner'),
  ('51000000-0000-4000-8000-000000000108', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000018', 'active', 'Scoped planner'),
  ('51000000-0000-4000-8000-000000000109', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000019', 'active', 'Scoped wage manager');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('51000000-0000-4000-8000-000000000201', '51000000-0000-4000-8000-000000000001', 'self_reporter_test', 'Self reporter', false),
  ('51000000-0000-4000-8000-000000000202', '51000000-0000-4000-8000-000000000001', 'reviewer_test', 'Reviewer', false),
  ('51000000-0000-4000-8000-000000000203', '51000000-0000-4000-8000-000000000001', 'warehouse_test', 'Warehouse', false),
  ('51000000-0000-4000-8000-000000000204', '51000000-0000-4000-8000-000000000001', 'manager_test', 'Manager', false),
  ('51000000-0000-4000-8000-000000000205', '51000000-0000-4000-8000-000000000001', 'order_editor_test', 'Order editor', false),
  ('51000000-0000-4000-8000-000000000206', '51000000-0000-4000-8000-000000000001', 'planner_test', 'Planner', false),
  ('51000000-0000-4000-8000-000000000207', '51000000-0000-4000-8000-000000000001', 'scoped_planner_test', 'Scoped planner', false),
  ('51000000-0000-4000-8000-000000000208', '51000000-0000-4000-8000-000000000001', 'wage_plan_test', 'Wage task planner', false),
  ('51000000-0000-4000-8000-000000000209', '51000000-0000-4000-8000-000000000001', 'scoped_wage_test', 'Scoped wage manager', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000201', 'production.report.self'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000202', 'production.review'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000203', 'shipping.manage'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000204', 'production.manage'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000205', 'orders.read'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000205', 'orders.update'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000206', 'production.plan'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000207', 'production.plan'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000207', 'production.assign'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000208', 'production.plan'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000209', 'wages.manage');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000201', '51000000-0000-4000-8000-000000000101', 'enterprise'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000202', '51000000-0000-4000-8000-000000000103', 'enterprise'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000203', '51000000-0000-4000-8000-000000000104', 'enterprise'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000204', '51000000-0000-4000-8000-000000000105', 'enterprise'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000205', '51000000-0000-4000-8000-000000000106', 'enterprise'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000206', '51000000-0000-4000-8000-000000000107', 'enterprise');

insert into public.role_bindings (id, tenant_id, role_id, membership_id, scope_kind) values
  ('51000000-0000-4000-8000-000000000801', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000207', '51000000-0000-4000-8000-000000000108', 'workshops'),
  ('51000000-0000-4000-8000-000000000802', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000208', '51000000-0000-4000-8000-000000000109', 'enterprise'),
  ('51000000-0000-4000-8000-000000000803', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000209', '51000000-0000-4000-8000-000000000109', 'workshops');

insert into public.role_binding_workshops (tenant_id, binding_id, workshop_id) values
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000801', '51000000-0000-4000-8000-000000000711'),
  ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000803', '51000000-0000-4000-8000-000000000711');

insert into public.workers (id, enterprise_id, user_id, worker_no, name, status, workshop_id) values
  ('51000000-0000-4000-8000-000000000301', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000011', 'SELF-1', 'Self worker', 'active', '51000000-0000-4000-8000-000000000711'),
  ('51000000-0000-4000-8000-000000000302', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000012', 'OTHER-1', 'Other worker', 'active', '51000000-0000-4000-8000-000000000712');

insert into public.wage_rules (id, enterprise_id, rule_name, task_type, unit, unit_price) values
  ('51000000-0000-4000-8000-000000000901', '51000000-0000-4000-8000-000000000001', 'Boundary wage rule', 'process', '件', 10);

insert into public.orders (id, enterprise_id, order_no, customer_name, status) values
  ('51000000-0000-4000-8000-000000000401', '51000000-0000-4000-8000-000000000001', 'PB-1', 'Boundary order', 'confirmed'),
  ('51000000-0000-4000-8000-000000000402', '51000000-0000-4000-8000-000000000001', 'PB-2', 'Mixed scope order', 'accepted'),
  ('51000000-0000-4000-8000-000000000403', '51000000-0000-4000-8000-000000000001', 'PB-3', 'Scoped order', 'confirmed'),
  ('51000000-0000-4000-8000-000000000404', '51000000-0000-4000-8000-000000000001', 'PB-4', 'Draft order', 'draft'),
  ('51000000-0000-4000-8000-000000000405', '51000000-0000-4000-8000-000000000001', 'PB-5', 'Pending order', 'pending'),
  ('51000000-0000-4000-8000-000000000406', '51000000-0000-4000-8000-000000000001', 'PB-6', 'Reviewed order', 'reviewed');

insert into public.order_spaces (id, enterprise_id, order_id, space_no, space_name, status) values
  ('51000000-0000-4000-8000-000000000411', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'S-1', 'Boundary space', 'draft');

insert into public.order_products (
  id, enterprise_id, order_id, space_id, product_no, product_name, status
) values (
  '51000000-0000-4000-8000-000000000421',
  '51000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000401',
  '51000000-0000-4000-8000-000000000411',
  'P-1',
  'Boundary product',
  'draft'
);

insert into public.work_orders (id, enterprise_id, order_id, product_name, target_quantity, completed_quantity, status) values
  ('51000000-0000-4000-8000-000000000501', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'Other task work order', 10, 0, 'producing'),
  ('51000000-0000-4000-8000-000000000502', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'Owned task work order', 10, 0, 'producing'),
  ('51000000-0000-4000-8000-000000000503', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'Review work order', 10, 0, 'producing'),
  ('51000000-0000-4000-8000-000000000504', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'Warehouse work order', 10, 10, 'inspecting'),
  ('51000000-0000-4000-8000-000000000505', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'Manager work order', 10, 0, 'producing');

insert into public.production_tasks (
  id, enterprise_id, work_order_id, product_name, assigned_worker_id, worker_id, status
) values
  ('51000000-0000-4000-8000-000000000601', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000501', 'Other task', '51000000-0000-4000-8000-000000000302', '51000000-0000-4000-8000-000000000302', 'producing'),
  ('51000000-0000-4000-8000-000000000602', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000502', 'Owned task', '51000000-0000-4000-8000-000000000301', '51000000-0000-4000-8000-000000000301', 'producing');

insert into public.production_tasks (
  id, enterprise_id, order_id, product_name, workshop_id, status
) values
  ('51000000-0000-4000-8000-000000000608', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000402', 'In-scope draft', '51000000-0000-4000-8000-000000000711', 'pending_generate'),
  ('51000000-0000-4000-8000-000000000609', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000402', 'Out-of-scope draft', '51000000-0000-4000-8000-000000000712', 'pending_generate'),
  ('51000000-0000-4000-8000-000000000614', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000403', 'Scoped draft', '51000000-0000-4000-8000-000000000711', 'pending_generate'),
  ('51000000-0000-4000-8000-000000000615', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000404', 'Draft bypass task', null, 'pending_generate'),
  ('51000000-0000-4000-8000-000000000616', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000405', 'Pending bypass task', null, 'pending_generate'),
  ('51000000-0000-4000-8000-000000000617', '51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000406', 'Reviewed bypass task', null, 'pending_generate');

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$select public.report_work_order_progress('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000501', 'report_progress', 1, null)$$,
  '42501',
  'WORK_ORDER_NOT_ASSIGNED_TO_REPORTER',
  'self reporter cannot mutate another worker work order'
);

select lives_ok(
  $$select public.report_work_order_progress('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000502', 'report_progress', 1, null)$$,
  'self reporter can report a work order backed by their assigned task'
);

select throws_ok(
  $$select public.report_work_order_progress('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000503', 'quality_check', 0, null)$$,
  '42501',
  'PRODUCTION_REVIEW_FORBIDDEN',
  'self report permission cannot perform quality review'
);

select throws_ok(
  $$insert into public.progress_logs (enterprise_id, work_order_id, action) values ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000502', 'forged')$$,
  '42501',
  'permission denied for table progress_logs',
  'authenticated callers cannot forge progress logs'
);

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000013', true);
set local role authenticated;

select throws_ok(
  $$select public.report_work_order_progress('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000503', 'quality_check', 1, null)$$,
  '22023',
  'CONTROL_ACTION_DELTA_MUST_BE_ZERO',
  'quality review cannot alter completed quantity'
);

reset role;
select is(
  (select completed_quantity from public.work_orders where id = '51000000-0000-4000-8000-000000000503'),
  0::numeric,
  'rejected quality review leaves completed quantity unchanged'
);
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000013', true);
set local role authenticated;

select lives_ok(
  $$select public.report_work_order_progress('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000503', 'quality_check', 0, null)$$,
  'production reviewer can move producing work to inspection'
);

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000014', true);
set local role authenticated;

select lives_ok(
  $$select public.report_work_order_progress('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000504', 'warehouse_in', 0, null)$$,
  'shipping manager can store inspected work'
);

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000015', true);
set local role authenticated;

select lives_ok(
  $$select public.report_work_order_progress('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000505', 'pause', 0, null)$$,
  'production manager can pause work'
);

select throws_ok(
  $$update public.production_tasks set status = 'completed', final_wage_amount = 999999 where id = '51000000-0000-4000-8000-000000000601'$$,
  '42501',
  'permission denied for table production_tasks',
  'production manager cannot bypass task workflow or wage controls'
);

select throws_ok(
  $$update public.work_orders set status = 'stored', completed_quantity = 10 where id = '51000000-0000-4000-8000-000000000505'$$,
  '42501',
  'permission denied for table work_orders',
  'production manager cannot bypass work-order progress RPC'
);

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000016', true);
set local role authenticated;

select throws_ok(
  $$update public.orders set status = 'completed' where id = '51000000-0000-4000-8000-000000000401'$$,
  '42501',
  'permission denied for table orders',
  'orders.update cannot bypass the order status state machine'
);

select throws_ok(
  $$insert into public.order_status_logs (enterprise_id, target_type, target_id, to_status) values ('51000000-0000-4000-8000-000000000001', 'order', '51000000-0000-4000-8000-000000000401', 'completed')$$,
  '42501',
  'permission denied for table order_status_logs',
  'orders.update cannot forge order audit history'
);

select throws_ok(
  $$update public.order_spaces set status = 'pending' where id = '51000000-0000-4000-8000-000000000411'$$,
  '42501',
  'permission denied for table order_spaces',
  'orders.update cannot bypass the space state machine'
);

select throws_ok(
  $$update public.order_products set status = 'pending' where id = '51000000-0000-4000-8000-000000000421'$$,
  '42501',
  'permission denied for table order_products',
  'orders.update cannot bypass the product state machine'
);

select throws_ok(
  $$insert into public.order_spaces (enterprise_id, order_id, space_no, space_name, status) values ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'S-FORGED', 'Forged space', 'completed')$$,
  '42501',
  'permission denied for table order_spaces',
  'orders.update cannot choose a terminal initial space status'
);

select throws_ok(
  $$insert into public.order_products (enterprise_id, order_id, space_id, product_no, product_name, status) values ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', '51000000-0000-4000-8000-000000000411', 'P-FORGED', 'Forged product', 'completed')$$,
  '42501',
  'permission denied for table order_products',
  'orders.update cannot choose a terminal initial product status'
);

select lives_ok(
  $$select public.create_order_space(
    '51000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000404',
    '{"space_name":"Safe space"}'::jsonb
  )$$,
  'orders.update can create a space through the guarded RPC'
);

select lives_ok(
  $$select public.create_order_product_with_pricing(
    '51000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000404',
    jsonb_build_object(
      'space_id', (
        select id::text from public.order_spaces
        where enterprise_id = '51000000-0000-4000-8000-000000000001'
          and order_id = '51000000-0000-4000-8000-000000000404'
          and space_name = 'Safe space'
      ),
      'product_no', 'P-SAFE',
      'product_name', 'Safe product'
    )
  )$$,
  'orders.update can create a product through the guarded RPC'
);

reset role;
select is(
  (select count(*)
   from public.order_status_logs status_log
   where status_log.target_id in (
     select id from public.order_spaces
     where enterprise_id = '51000000-0000-4000-8000-000000000001'
       and order_id = '51000000-0000-4000-8000-000000000404'
       and space_name = 'Safe space'
     union all
     select id from public.order_products
     where enterprise_id = '51000000-0000-4000-8000-000000000001'
       and order_id = '51000000-0000-4000-8000-000000000404'
       and product_name = 'Safe product'
   )),
  2::bigint,
  'database-generated audit entries cover guarded component creation'
);

set local role authenticated;
select lives_ok(
  $$select public.transition_order_component_status('51000000-0000-4000-8000-000000000001', 'space', '51000000-0000-4000-8000-000000000411', 'draft', 'pending', 'submit space')$$,
  'orders.update can perform an adjacent space transition through the guarded RPC'
);

select lives_ok(
  $$select public.transition_order_component_status('51000000-0000-4000-8000-000000000001', 'product', '51000000-0000-4000-8000-000000000421', 'draft', 'pending', 'submit product')$$,
  'orders.update can perform an adjacent product transition through the guarded RPC'
);

select throws_ok(
  $$select public.transition_order_component_status('51000000-0000-4000-8000-000000000001', 'product', '51000000-0000-4000-8000-000000000421', 'pending', 'completed', 'skip workflow')$$,
  '22023',
  'COMPONENT_STATUS_TRANSITION_INVALID',
  'component RPC rejects a non-adjacent status jump'
);

reset role;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000017', true);
set local role authenticated;

select throws_ok(
  $$insert into public.production_tasks (enterprise_id, order_id, product_name, status) values ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'Forged task', 'completed')$$,
  '42501',
  'permission denied for table production_tasks',
  'planner cannot create a terminal task directly'
);

select throws_ok(
  $$insert into public.work_orders (enterprise_id, order_id, product_name, target_quantity, completed_quantity, status) values ('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'Forged work order', 1, 1, 'stored')$$,
  '42501',
  'permission denied for table work_orders',
  'planner cannot create a completed work order directly'
);

select lives_ok(
  $$select public.create_production_tasks(
    '51000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000401',
    '[{"id":"51000000-0000-4000-8000-000000000603","space_id":"51000000-0000-4000-8000-000000000411","product_id":"51000000-0000-4000-8000-000000000421","task_no":"SAFE-TASK-1","task_type":"process","task_name":"Safe task","product_name":"Boundary product","quantity":1,"unit":"件","initial_status":"pending_generate"}]'::jsonb
  )$$,
  'planner can create a safe draft task through the guarded RPC'
);

select lives_ok(
  $$select public.confirm_order_task_drafts('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'confirmed', 'confirm split')$$,
  'planner can confirm draft tasks through the guarded RPC'
);

select throws_ok(
  $$select public.confirm_order_task_drafts('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000404', 'draft', 'skip draft')$$,
  'P0001',
  'ORDER_STATUS_TRANSITION_INVALID',
  'planner cannot bypass order review from draft to the production pool'
);

select throws_ok(
  $$select public.confirm_order_task_drafts('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000405', 'pending', 'skip pending')$$,
  'P0001',
  'ORDER_STATUS_TRANSITION_INVALID',
  'planner cannot bypass order confirmation from pending to the production pool'
);

select throws_ok(
  $$select public.confirm_order_task_drafts('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000406', 'reviewed', 'skip reviewed')$$,
  'P0001',
  'ORDER_STATUS_TRANSITION_INVALID',
  'planner cannot bypass order confirmation from reviewed to the production pool'
);

reset role;
select is(
  (select status from public.production_tasks where id = '51000000-0000-4000-8000-000000000603'),
  'pending_assign',
  'guarded task confirmation performs the expected adjacent transition'
);

select is(
  (select count(*) from public.production_tasks
   where id in (
     '51000000-0000-4000-8000-000000000615',
     '51000000-0000-4000-8000-000000000616',
     '51000000-0000-4000-8000-000000000617'
   ) and status = 'pending_generate'),
  3::bigint,
  'rejected order-state bypass attempts leave all draft tasks unchanged'
);

select is(
  (select count(*) from public.order_status_logs
   where target_id in (
     '51000000-0000-4000-8000-000000000404',
     '51000000-0000-4000-8000-000000000405',
     '51000000-0000-4000-8000-000000000406'
   )),
  0::bigint,
  'rejected order-state bypass attempts create no audit log'
);

set local role authenticated;
select lives_ok(
  $$select public.create_production_tasks(
    '51000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000401',
    '[
      {"id":"51000000-0000-4000-8000-000000000610","task_no":"TYPE-BOARD","task_type":"board","task_name":"Board task","product_name":"Boundary product","quantity":1,"unit":"件","initial_status":"pending_assign"},
      {"id":"51000000-0000-4000-8000-000000000611","task_no":"TYPE-DOOR","task_type":"door","task_name":"Door task","product_name":"Boundary product","quantity":1,"unit":"件","initial_status":"pending_assign"},
      {"id":"51000000-0000-4000-8000-000000000612","task_no":"TYPE-SPECIAL","task_type":"special","task_name":"Special task","product_name":"Boundary product","quantity":1,"unit":"件","initial_status":"pending_assign"},
      {"id":"51000000-0000-4000-8000-000000000613","task_no":"TYPE-HARDWARE","task_type":"hardware","task_name":"Hardware task","product_name":"Boundary product","quantity":1,"unit":"件","initial_status":"pending_assign"}
    ]'::jsonb
  )$$,
  'guarded task creation accepts every front-end product task type'
);

reset role;

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000018', true);
set local role authenticated;

select lives_ok(
  $$select public.create_production_tasks(
    '51000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000401',
    '[{"id":"51000000-0000-4000-8000-000000000604","task_no":"SCOPED-TASK-1","task_type":"process","task_name":"Scoped task","product_name":"Boundary product","quantity":1,"unit":"件","workshop_id":"51000000-0000-4000-8000-000000000711","initial_status":"pending_generate"}]'::jsonb
  )$$,
  'workshop-scoped planner can create a task inside the granted workshop'
);

select throws_ok(
  $$select public.create_production_tasks(
    '51000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000401',
    '[{"id":"51000000-0000-4000-8000-000000000605","task_no":"SCOPED-TASK-2","task_type":"process","task_name":"Out of scope task","product_name":"Boundary product","quantity":1,"unit":"件","workshop_id":"51000000-0000-4000-8000-000000000712","initial_status":"pending_generate"}]'::jsonb
  )$$,
  '42501',
  'PRODUCTION_WORKSHOP_FORBIDDEN',
  'workshop-scoped planner cannot create a task in another workshop'
);

select throws_ok(
  $$select public.create_production_tasks(
    '51000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000401',
    '[{"id":"51000000-0000-4000-8000-000000000606","task_no":"SCOPED-TASK-3","task_type":"process","task_name":"Cross workshop assignment","product_name":"Boundary product","quantity":1,"unit":"件","workshop_id":"51000000-0000-4000-8000-000000000711","assigned_worker_id":"51000000-0000-4000-8000-000000000302","initial_status":"assigned"}]'::jsonb
  )$$,
  'P0002',
  'ASSIGNABLE_WORKER_NOT_FOUND',
  'scoped assign grant cannot assign a worker from another workshop'
);

select lives_ok(
  $$select public.confirm_order_task_drafts('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000403', 'confirmed', 'scoped confirmation')$$,
  'workshop-scoped planner can confirm drafts wholly inside the granted workshop'
);

select throws_ok(
  $$select public.confirm_order_task_drafts('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000402', 'accepted', 'mixed scope confirmation')$$,
  '42501',
  'PRODUCTION_WORKSHOP_FORBIDDEN',
  'workshop-scoped planner cannot confirm an order containing an out-of-scope draft'
);

select throws_ok(
  $$select public.confirm_order_task_drafts('51000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000401', 'pending', 'stale confirmation')$$,
  'P0001',
  'ORDER_STATUS_CONFLICT',
  'stale order status prevents draft task confirmation'
);

reset role;
select is(
  (select status from public.production_tasks where id = '51000000-0000-4000-8000-000000000614'),
  'pending_assign',
  'scoped confirmation updates the in-scope draft'
);
select is(
  (select status from public.orders where id = '51000000-0000-4000-8000-000000000403'),
  'pool',
  'scoped confirmation atomically advances its order'
);
select is(
  (select count(*) from public.production_tasks
   where id in ('51000000-0000-4000-8000-000000000608', '51000000-0000-4000-8000-000000000609')
     and status = 'pending_generate'),
  2::bigint,
  'mixed-scope confirmation rolls back every draft transition'
);
select is(
  (select status from public.production_tasks where id = '51000000-0000-4000-8000-000000000604'),
  'pending_generate',
  'failed atomic confirmation leaves the draft task unchanged'
);
select is(
  (select count(*) from public.order_status_logs
   where target_id = '51000000-0000-4000-8000-000000000604'
     and from_status = 'pending_generate'
     and to_status = 'pending_assign'),
  0::bigint,
  'failed atomic confirmation leaves no transition audit entry'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000019', true);
set local role authenticated;

select throws_ok(
  $$select public.create_production_tasks(
    '51000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000401',
    '[{"id":"51000000-0000-4000-8000-000000000607","task_no":"WAGE-SCOPE-MISMATCH","task_type":"process","task_name":"Out of scope wage task","product_name":"Boundary product","quantity":1,"unit":"件","workshop_id":"51000000-0000-4000-8000-000000000712","wage_rule_id":"51000000-0000-4000-8000-000000000901","estimated_wage_amount":10,"initial_status":"pending_generate"}]'::jsonb
  )$$,
  '42501',
  'PRODUCTION_WAGE_FORBIDDEN',
  'workshop-scoped wage grant cannot set wages for a task in another workshop'
);

reset role;

select * from finish();

rollback;
