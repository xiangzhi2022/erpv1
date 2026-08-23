begin;

select no_plan();

select ok(
  not has_column_privilege('authenticated', 'public.orders', 'deposit_amount', 'SELECT')
  and not has_column_privilege('authenticated', 'public.orders', 'cost_amount', 'SELECT')
  and not has_column_privilege('authenticated', 'public.orders', 'profit_amount', 'SELECT')
  and not has_column_privilege('authenticated', 'public.orders', 'internal_remark', 'SELECT')
  and not has_column_privilege('authenticated', 'public.order_items', 'unit_price', 'SELECT')
  and not has_column_privilege('authenticated', 'public.order_items', 'subtotal', 'SELECT')
  and not has_column_privilege('authenticated', 'public.order_products', 'quoted_amount', 'SELECT')
  and not has_column_privilege('authenticated', 'public.order_products', 'cost_amount', 'SELECT')
  and not has_column_privilege('authenticated', 'public.order_products', 'profit_amount', 'SELECT')
  and not has_column_privilege('authenticated', 'public.order_products', 'internal_remark', 'SELECT')
  and not has_column_privilege('authenticated', 'public.production_tasks', 'wage_rule_id', 'SELECT')
  and not has_column_privilege('authenticated', 'public.production_tasks', 'estimated_wage_amount', 'SELECT')
  and not has_column_privilege('authenticated', 'public.production_tasks', 'final_wage_amount', 'SELECT')
  and not has_column_privilege('authenticated', 'public.employees', 'base_salary', 'SELECT'),
  'authenticated callers cannot directly select financial or wage detail columns'
);

select ok(
  has_column_privilege('authenticated', 'public.orders', 'total_amount', 'SELECT')
  and has_column_privilege('authenticated', 'public.order_items', 'product_name', 'SELECT')
  and has_column_privilege('authenticated', 'public.order_products', 'product_name', 'SELECT')
  and has_column_privilege('authenticated', 'public.production_tasks', 'task_name', 'SELECT'),
  'authenticated callers retain direct reads of safe business columns'
);

insert into public.enterprises (id, code, name, enterprise_type) values
  ('71000000-0000-4000-8000-000000000001', 'sensitive-read', 'Sensitive read', 'dealer'),
  ('72000000-0000-4000-8000-000000000002', 'sensitive-peer', 'Sensitive peer', 'manufacturer');

insert into public.sites (id, tenant_id, code, name, site_type) values (
  '71000000-0000-4000-8000-000000000701',
  '71000000-0000-4000-8000-000000000001',
  'SITE-READ',
  'Scoped site',
  'factory'
);

insert into public.workshops (id, tenant_id, site_id, code, name) values
  (
    '71000000-0000-4000-8000-000000000711',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000701',
    'WORKSHOP-READ',
    'Scoped workshop'
  ),
  (
    '71000000-0000-4000-8000-000000000712',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000701',
    'WORKSHOP-OTHER',
    'Other workshop'
  );

insert into auth.users (id, email, created_at, updated_at) values
  ('71000000-0000-4000-8000-000000000011', 'order-reader@example.invalid', now(), now()),
  ('71000000-0000-4000-8000-000000000012', 'worker-a@example.invalid', now(), now()),
  ('71000000-0000-4000-8000-000000000013', 'worker-b@example.invalid', now(), now()),
  ('71000000-0000-4000-8000-000000000014', 'finance-reader@example.invalid', now(), now()),
  ('71000000-0000-4000-8000-000000000015', 'wage-reader@example.invalid', now(), now()),
  ('71000000-0000-4000-8000-000000000016', 'scoped-finance@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('71000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000011', 'active', 'Order reader'),
  ('71000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000012', 'active', 'Worker A'),
  ('71000000-0000-4000-8000-000000000103', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000013', 'active', 'Worker B'),
  ('71000000-0000-4000-8000-000000000104', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000014', 'active', 'Finance reader'),
  ('71000000-0000-4000-8000-000000000105', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000015', 'active', 'Wage reader'),
  ('71000000-0000-4000-8000-000000000106', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000016', 'active', 'Scoped finance');

insert into public.profiles (id, enterprise_id, display_name, phone)
values (
  '71000000-0000-4000-8000-000000000011',
  '71000000-0000-4000-8000-000000000001',
  'Protected profile',
  '000-PROFILE'
)
on conflict (id) do update
set enterprise_id = excluded.enterprise_id,
    display_name = excluded.display_name,
    phone = excluded.phone;

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('71000000-0000-4000-8000-000000000201', '71000000-0000-4000-8000-000000000001', 'order_reader_boundary', 'Order reader', false),
  ('71000000-0000-4000-8000-000000000202', '71000000-0000-4000-8000-000000000001', 'worker_reader_boundary', 'Worker reader', false),
  ('71000000-0000-4000-8000-000000000207', '71000000-0000-4000-8000-000000000001', 'worker_self_wage_boundary', 'Worker self wage', false),
  ('71000000-0000-4000-8000-000000000204', '71000000-0000-4000-8000-000000000001', 'finance_reader_boundary', 'Finance reader', false),
  ('71000000-0000-4000-8000-000000000205', '71000000-0000-4000-8000-000000000001', 'wage_reader_boundary', 'Wage reader', false),
  ('71000000-0000-4000-8000-000000000206', '71000000-0000-4000-8000-000000000001', 'scoped_finance_boundary', 'Scoped finance', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', 'orders.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', 'members.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000202', 'production.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000207', 'wages.read.self'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000204', 'finance.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000205', 'wages.read.all'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000205', 'finance.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'finance.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'finance.manage'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'wages.read.all'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'wages.read.self'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'customers.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'customers.manage'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'members.manage'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'wages.manage'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'wages.settle'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'orders.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'members.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'production.read'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'production.plan'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'orders.update'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'orders.submit'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000206', 'orders.accept');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', '71000000-0000-4000-8000-000000000101', 'enterprise'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000202', '71000000-0000-4000-8000-000000000102', 'enterprise'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000202', '71000000-0000-4000-8000-000000000103', 'enterprise'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000207', '71000000-0000-4000-8000-000000000102', 'self'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000207', '71000000-0000-4000-8000-000000000103', 'self'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000204', '71000000-0000-4000-8000-000000000104', 'enterprise'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000205', '71000000-0000-4000-8000-000000000105', 'enterprise');

insert into public.role_bindings (id, tenant_id, role_id, membership_id, scope_kind) values (
  '71000000-0000-4000-8000-000000000801',
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000206',
  '71000000-0000-4000-8000-000000000106',
  'workshops'
);

insert into public.role_binding_workshops (tenant_id, binding_id, workshop_id) values (
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000801',
  '71000000-0000-4000-8000-000000000711'
);

insert into public.workers (id, enterprise_id, user_id, worker_no, name, status) values
  ('71000000-0000-4000-8000-000000000301', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000012', 'WORKER-A', 'Worker A', 'active'),
  ('71000000-0000-4000-8000-000000000302', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000013', 'WORKER-B', 'Worker B', 'active');

insert into public.employees (id, enterprise_id, employee_no, name, base_salary) values
  ('71000000-0000-4000-8000-000000000311', '71000000-0000-4000-8000-000000000001', 'EMP-A', 'Employee A', 800000),
  ('71000000-0000-4000-8000-000000000312', '71000000-0000-4000-8000-000000000001', 'EMP-B', 'Employee B', 900000);

insert into public.customers (id, enterprise_id, name, phone, address) values (
  '71000000-0000-4000-8000-000000000321',
  '71000000-0000-4000-8000-000000000001',
  'Boundary customer record',
  '000-REDACTED',
  'Boundary address'
);

insert into public.wage_rules (
  id, enterprise_id, rule_name, task_type, unit_price, extra_amount
) values (
  '71000000-0000-4000-8000-000000000322',
  '71000000-0000-4000-8000-000000000001',
  'Boundary wage rule',
  'process',
  125,
  25
);

insert into public.orders (
  id, enterprise_id, order_no, customer_name, status, total_amount,
  deposit_amount, cost_amount, profit_amount, internal_remark
) values (
  '71000000-0000-4000-8000-000000000401',
  '71000000-0000-4000-8000-000000000001',
  'READ-BOUNDARY-1',
  'Boundary customer',
  'pending',
  1000,
  100,
  600,
  400,
  'finance only'
);

insert into public.orders (
  id, enterprise_id, order_no, customer_name, status
) values (
  '72000000-0000-4000-8000-000000000402',
  '72000000-0000-4000-8000-000000000002',
  'READ-BOUNDARY-PEER',
  'Peer customer',
  'pending'
);

insert into public.order_exchanges (
  id, enterprise_id, order_id, from_enterprise_id, to_enterprise_id,
  from_user_id, status
) values
  (
    '71000000-0000-4000-8000-000000000721',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401',
    '71000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000016',
    'sent'
  ),
  (
    '72000000-0000-4000-8000-000000000722',
    '72000000-0000-4000-8000-000000000002',
    '72000000-0000-4000-8000-000000000402',
    '72000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000016',
    'sent'
  );

insert into public.order_spaces (id, enterprise_id, order_id, space_no, space_name) values (
  '71000000-0000-4000-8000-000000000411',
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000401',
  'SPACE-1',
  'Boundary space'
);

insert into public.order_items (
  id, enterprise_id, order_id, product_name, quantity, unit_price, subtotal
) values (
  '71000000-0000-4000-8000-000000000431',
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000401',
  'Boundary item',
  1,
  1000,
  1000
);

insert into public.order_products (
  id, enterprise_id, order_id, space_id, product_no, product_name,
  quoted_amount, cost_amount, profit_amount, internal_remark
) values (
  '71000000-0000-4000-8000-000000000421',
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000401',
  '71000000-0000-4000-8000-000000000411',
  'PRODUCT-1',
  'Boundary product',
  1000,
  600,
  400,
  'product finance only'
);

insert into public.production_tasks (
  id, enterprise_id, order_id, product_name, task_name, assigned_worker_id, worker_id,
  wage_rule_id, estimated_wage_amount, final_wage_amount
) values
  ('71000000-0000-4000-8000-000000000501', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000401', 'Product A', 'Task A', '71000000-0000-4000-8000-000000000301', '71000000-0000-4000-8000-000000000301', null, 25, 20),
  ('71000000-0000-4000-8000-000000000502', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000401', 'Product B', 'Task B', '71000000-0000-4000-8000-000000000302', '71000000-0000-4000-8000-000000000302', null, 35, 30);

insert into public.production_tasks (
  id, enterprise_id, product_name, task_name, workshop_id
) values
  ('71000000-0000-4000-8000-000000000503', '71000000-0000-4000-8000-000000000001', 'Scoped product', 'Scoped task', '71000000-0000-4000-8000-000000000711'),
  ('71000000-0000-4000-8000-000000000504', '71000000-0000-4000-8000-000000000001', 'Other product', 'Other task', '71000000-0000-4000-8000-000000000712');

insert into public.worker_wage_records (
  id, enterprise_id, order_id, task_id, worker_id, quantity, unit_price, wage_amount
) values
  ('71000000-0000-4000-8000-000000000601', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000401', '71000000-0000-4000-8000-000000000501', '71000000-0000-4000-8000-000000000301', 1, 20, 20),
  ('71000000-0000-4000-8000-000000000602', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000401', '71000000-0000-4000-8000-000000000502', '71000000-0000-4000-8000-000000000302', 1, 30, 30);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select results_eq(
  $$select id from public.orders where id = '71000000-0000-4000-8000-000000000401'$$,
  $$values ('71000000-0000-4000-8000-000000000401'::uuid)$$,
  'order-only dealer can read safe order columns'
);

select throws_ok(
  $$select cost_amount from public.orders where id = '71000000-0000-4000-8000-000000000401'$$,
  '42501',
  'permission denied for table orders',
  'order-only dealer cannot directly read order finance columns'
);

select throws_ok(
  $$select unit_price from public.order_items where order_id = '71000000-0000-4000-8000-000000000401'$$,
  '42501',
  'permission denied for table order_items',
  'order-only dealer cannot directly read order item prices'
);

select throws_ok(
  $$select public.finance_read_order_details('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000401')$$,
  '42501',
  'FINANCE_READ_FORBIDDEN',
  'order-only dealer cannot use the finance detail RPC'
);

select throws_ok(
  $$select * from public.finance_list_order_item_amounts(
    '71000000-0000-4000-8000-000000000001',
    array['71000000-0000-4000-8000-000000000401'::uuid]
  )$$,
  '42501',
  'FINANCE_READ_FORBIDDEN',
  'order-only dealer cannot use the batch order item pricing RPC'
);

select results_eq(
  $$select id from public.employees order by id$$,
  $$values
    ('71000000-0000-4000-8000-000000000311'::uuid),
    ('71000000-0000-4000-8000-000000000312'::uuid)$$,
  'members.read caller can read safe employee columns'
);

select throws_ok(
  $$select base_salary from public.employees$$,
  '42501',
  'permission denied for table employees',
  'members.read caller cannot directly read employee base salary'
);

select throws_ok(
  $$select public.wages_read_employee_base_salaries('71000000-0000-4000-8000-000000000001')$$,
  '42501',
  'WAGES_READ_FORBIDDEN',
  'members.read caller cannot use the employee salary RPC'
);

reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select results_eq(
  $$select id from public.production_tasks order by id$$,
  $$values ('71000000-0000-4000-8000-000000000501'::uuid)$$,
  'production.read-only worker sees only their assigned task'
);

select throws_ok(
  $$select estimated_wage_amount from public.production_tasks$$,
  '42501',
  'permission denied for table production_tasks',
  'production worker cannot directly read task wage columns'
);

select results_eq(
  $$select id from public.worker_wage_records order by id$$,
  $$values ('71000000-0000-4000-8000-000000000601'::uuid)$$,
  'wages.read.self worker sees only their own wage record'
);

reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000014', true);
set local role authenticated;

select is(
  (public.finance_read_order_details(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401'
  ) #>> '{order,cost_amount}')::numeric,
  600::numeric,
  'enterprise finance reader receives order finance details through the RPC'
);

select ok(
  (select labor_cost is null from public.finance_list_order_summaries(
    '71000000-0000-4000-8000-000000000001', null
  ) where id = '71000000-0000-4000-8000-000000000401'),
  'finance-only reader does not receive labor cost derived from wages'
);

select is(
  jsonb_array_length(public.finance_read_order_details(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401'
  ) -> 'products'),
  1,
  'finance detail RPC returns only products for the requested enterprise order'
);

select is(
  (public.finance_read_order_details(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401'
  ) #>> '{items,0,unit_price}')::numeric,
  1000::numeric,
  'finance detail RPC returns order item prices to an enterprise finance reader'
);

select results_eq(
  $$select id, order_id, unit_price, subtotal
    from public.finance_list_order_item_amounts(
      '71000000-0000-4000-8000-000000000001',
      array['71000000-0000-4000-8000-000000000401'::uuid]
    )$$,
  $$values (
    '71000000-0000-4000-8000-000000000431'::uuid,
    '71000000-0000-4000-8000-000000000401'::uuid,
    1000::numeric,
    1000::numeric
  )$$,
  'enterprise finance reader receives requested order item prices in one batch'
);

reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000015', true);
set local role authenticated;

select is(
  jsonb_array_length(public.wages_read_order_task_amounts(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401'
  )),
  2,
  'enterprise wage reader receives task wage details through the RPC'
);

select is(
  (public.wages_read_order_task_amounts(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401'
  ) -> 1 ->> 'final_wage_amount')::numeric,
  30::numeric,
  'wage RPC returns the authorized task amount'
);

select is(
  (select labor_cost from public.finance_list_order_summaries(
    '71000000-0000-4000-8000-000000000001', null
  ) where id = '71000000-0000-4000-8000-000000000401'),
  50::numeric,
  'enterprise finance and wage reader receives labor cost'
);

select is(
  jsonb_array_length(public.wages_read_employee_base_salaries(
    '71000000-0000-4000-8000-000000000001'
  )),
  2,
  'enterprise wage reader receives employee base salaries through the RPC'
);

reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000016', true);
set local role authenticated;

select is(
  (select count(*) from public.orders),
  0::bigint,
  'workshop-scoped orders.read cannot read enterprise order rows without a workshop mapping'
);

select is(
  (select count(*) from public.order_items),
  0::bigint,
  'workshop-scoped orders.read cannot read enterprise order item rows without a workshop mapping'
);

select is(
  (select count(*) from public.order_products),
  0::bigint,
  'workshop-scoped orders.read cannot read enterprise order product rows without a workshop mapping'
);

select is(
  (select count(*) from public.employees),
  0::bigint,
  'workshop-scoped members.read cannot read enterprise employee PII without a workshop mapping'
);

select is(
  (select count(*) from public.customers),
  0::bigint,
  'workshop-scoped customers.read cannot read enterprise customer PII'
);

select is(
  (select count(*) from public.order_exchanges),
  0::bigint,
  'workshop-scoped orders.read cannot read enterprise order exchange messages'
);

select is(
  (select count(*) from public.wage_rules),
  0::bigint,
  'workshop-scoped wages.manage cannot read enterprise wage pricing rules'
);

select throws_ok(
  $$
    insert into public.customers (enterprise_id, name)
    values ('71000000-0000-4000-8000-000000000001', 'Scoped customer write')
  $$,
  '42501',
  'new row violates row-level security policy for table "customers"',
  'workshop-scoped customers.manage cannot insert enterprise customer data'
);

select lives_ok(
  $$update public.customers set name = 'Scoped update'
    where id = '71000000-0000-4000-8000-000000000321'$$,
  'workshop-scoped customers.manage cannot update enterprise customer data'
);

reset role;
select results_eq(
  $$select name from public.customers
    where id = '71000000-0000-4000-8000-000000000321'$$,
  $$values ('Boundary customer record'::text)$$,
  'a workshop-scoped update leaves enterprise customer data unchanged'
);
set local role authenticated;

select lives_ok(
  $$delete from public.customers
    where id = '71000000-0000-4000-8000-000000000321'$$,
  'workshop-scoped customers.manage cannot delete enterprise customer data'
);

reset role;
select is(
  (select count(*) from public.customers
   where id = '71000000-0000-4000-8000-000000000321'),
  1::bigint,
  'a workshop-scoped delete leaves enterprise customer data intact'
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.wage_rules (
      enterprise_id, rule_name, task_type, unit_price, extra_amount
    ) values (
      '71000000-0000-4000-8000-000000000001',
      'Scoped wage rule',
      'process',
      999,
      0
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "wage_rules"',
  'workshop-scoped wages.manage cannot write enterprise wage pricing rules'
);

select lives_ok(
  $$update public.profiles set display_name = 'Scoped profile overwrite'
    where id = '71000000-0000-4000-8000-000000000011'$$,
  'workshop-scoped members.manage cannot update another enterprise profile'
);

reset role;
select results_eq(
  $$select display_name from public.profiles
    where id = '71000000-0000-4000-8000-000000000011'$$,
  $$values ('Protected profile'::text)$$,
  'a workshop-scoped update leaves the protected profile unchanged'
);
set local role authenticated;

select throws_ok(
  $$
    delete from public.profiles
    where id = '71000000-0000-4000-8000-000000000011'
  $$,
  '42501',
  'permission denied for table profiles',
  'authenticated users cannot directly delete profiles'
);

select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.profiles', 'DELETE')
  and not has_column_privilege('authenticated', 'public.profiles', 'enterprise_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE'),
  'profile identity and lifecycle columns are not directly writable'
);

select results_eq(
  $$select id from public.production_tasks order by id$$,
  $$values ('71000000-0000-4000-8000-000000000503'::uuid)$$,
  'workshop-scoped production planner reads only tasks mapped to the granted workshop'
);

select throws_ok(
  $$select public.finance_read_order_details('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000401')$$,
  '42501',
  'FINANCE_READ_FORBIDDEN',
  'workshop-scoped finance permission cannot read enterprise order details'
);

select throws_ok(
  $$select * from public.finance_list_order_item_amounts(
    '71000000-0000-4000-8000-000000000001',
    array['71000000-0000-4000-8000-000000000401'::uuid]
  )$$,
  '42501',
  'FINANCE_READ_FORBIDDEN',
  'workshop-scoped finance permission cannot batch read enterprise order item prices'
);

select throws_ok(
  $$select public.wages_read_order_task_amounts('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000401')$$,
  '42501',
  'WAGES_READ_FORBIDDEN',
  'workshop-scoped wage permission cannot read all order task wages'
);

select throws_ok(
  $$select * from public.finance_list_order_summaries('71000000-0000-4000-8000-000000000001', null)$$,
  '42501',
  'finance permission denied',
  'workshop-scoped finance permission cannot list enterprise order summaries'
);

select throws_ok(
  $$select * from public.finance_list_wages('71000000-0000-4000-8000-000000000001', null, null)$$,
  '42501',
  'finance wage permission denied',
  'workshop-scoped permissions cannot list enterprise wages'
);

select throws_ok(
  $$select * from public.finance_list_settlements('71000000-0000-4000-8000-000000000001')$$,
  '42501',
  'finance wage permission denied',
  'workshop-scoped permissions cannot list enterprise settlements'
);

select throws_ok(
  $$select * from public.finance_update_order_pricing(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401',
    1000, 600, 400, 100
  )$$,
  '42501',
  'finance permission denied',
  'workshop-scoped finance.manage cannot update enterprise order pricing'
);

select throws_ok(
  $$select * from public.finance_manage_wage_record(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000601',
    'pending', 'approved', null, null, null
  )$$,
  '42501',
  'wage management permission denied',
  'workshop-scoped wages.manage cannot manage enterprise wage records through the legacy RPC'
);

select throws_ok(
  $$select * from public.finance_settle_wage_records(
    '71000000-0000-4000-8000-000000000001',
    array['71000000-0000-4000-8000-000000000601'::uuid]
  )$$,
  '42501',
  'wage settlement permission denied',
  'workshop-scoped wages.settle cannot settle enterprise wage records through the legacy RPC'
);

select throws_ok(
  $$select * from public.finance_pay_wage_record(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000601'
  )$$,
  '42501',
  'wage settlement permission denied',
  'workshop-scoped wages.settle cannot pay enterprise wage records'
);

select throws_ok(
  $$insert into public.worker_wage_records (
    enterprise_id, worker_id, quantity, unit_price, wage_amount
  ) values (
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000301',
    1, 1, 1
  )$$,
  '42501',
  'permission denied for table worker_wage_records',
  'workshop-scoped wages.manage cannot directly insert enterprise wage records'
);

select throws_ok(
  $$update public.worker_wage_records set wage_amount = 999
    where id = '71000000-0000-4000-8000-000000000601'$$,
  '42501',
  'permission denied for table worker_wage_records',
  'workshop-scoped wages.manage cannot directly update enterprise wage records'
);

select throws_ok(
  $$select * from public.create_order_exchange(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401',
    '72000000-0000-4000-8000-000000000002',
    null, null
  )$$,
  '42501',
  'ORDER_EXCHANGE_SUBMIT_FORBIDDEN',
  'workshop-scoped orders.submit cannot create an enterprise order exchange'
);

select throws_ok(
  $$select * from public.transition_order_exchange(
    '71000000-0000-4000-8000-000000000721', 'withdraw', null, null
  )$$,
  '42501',
  'ORDER_EXCHANGE_UPDATE_FORBIDDEN',
  'workshop-scoped orders.update cannot withdraw an enterprise order exchange'
);

select throws_ok(
  $$select * from public.transition_order_exchange(
    '72000000-0000-4000-8000-000000000722', 'accept', null, null
  )$$,
  '42501',
  'ORDER_EXCHANGE_ACCEPT_FORBIDDEN',
  'workshop-scoped orders.accept cannot accept an enterprise order exchange'
);

select throws_ok(
  $$select public.transition_order_exchanges_for_order(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401',
    'withdraw', null
  )$$,
  '42501',
  'ORDER_EXCHANGE_UPDATE_FORBIDDEN',
  'bulk exchange wrapper cannot elevate a workshop-scoped order grant'
);

select throws_ok(
  $$select * from public.transition_order_status(
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000401',
    'pending', 'submitted', null
  )$$,
  '42501',
  'ORDER_STATUS_FORBIDDEN',
  'workshop-scoped orders.update cannot transition an enterprise order'
);

select is(
  (select count(*) from public.worker_wage_records),
  0::bigint,
  'workshop-scoped wages.read.all cannot directly read enterprise wage records'
);

reset role;
select * from finish();
rollback;
