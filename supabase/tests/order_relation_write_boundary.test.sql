begin;

select no_plan();

select ok(
  not exists (
    select 1
    from pg_attribute attribute
    where attribute.attrelid = 'public.orders'::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and has_column_privilege(
        'authenticated',
        'public.orders',
        attribute.attname,
        'INSERT'
      )
  ),
  'authenticated callers cannot directly insert orders'
);

select ok(
  not has_table_privilege('authenticated', 'public.orders', 'DELETE')
  and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'orders_delete'
  ),
  'authenticated callers cannot directly delete orders'
);

select ok(
  not has_column_privilege('authenticated', 'public.orders', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'order_flow', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'from_enterprise_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'to_enterprise_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'target_factory_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'dealer_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'parent_order_id', 'UPDATE'),
  'authenticated callers cannot directly update order relationship fields'
);

select ok(
  has_column_privilege('authenticated', 'public.orders', 'customer_name', 'UPDATE')
  and has_column_privilege('authenticated', 'public.orders', 'remark', 'UPDATE')
  and has_function_privilege(
    'authenticated',
    'public.create_basic_order(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated callers retain safe base updates and guarded basic creation'
);

insert into public.enterprises (id, code, name, enterprise_type) values
  ('71000000-0000-4000-8000-000000000001', 'relation-dealer-a', 'Relation dealer A', 'dealer'),
  ('72000000-0000-4000-8000-000000000002', 'relation-factory-b', 'Relation factory B', 'manufacturer');

insert into auth.users (id, email, created_at, updated_at) values
  ('71000000-0000-4000-8000-000000000011', 'relation-enterprise@example.invalid', now(), now()),
  ('71000000-0000-4000-8000-000000000012', 'relation-scoped@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('71000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000011', 'active', 'Relation enterprise writer'),
  ('71000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000012', 'active', 'Relation scoped writer');

insert into public.roles (id, tenant_id, code, name, is_system) values (
  '71000000-0000-4000-8000-000000000201',
  '71000000-0000-4000-8000-000000000001',
  'relation_order_creator',
  'Relation order creator',
  false
);

insert into public.role_permissions (tenant_id, role_id, permission_code) values (
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000201',
  'orders.create'
);

insert into public.role_bindings (
  id, tenant_id, role_id, membership_id, scope_kind
) values
  (
    '71000000-0000-4000-8000-000000000301',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000201',
    '71000000-0000-4000-8000-000000000101',
    'enterprise'
  ),
  (
    '71000000-0000-4000-8000-000000000302',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000201',
    '71000000-0000-4000-8000-000000000102',
    'workshops'
  );

insert into public.sites (id, tenant_id, code, name, site_type) values (
  '71000000-0000-4000-8000-000000000401',
  '71000000-0000-4000-8000-000000000001',
  'RELATION-SITE',
  'Relation site',
  'factory'
);

insert into public.workshops (id, tenant_id, site_id, code, name) values (
  '71000000-0000-4000-8000-000000000501',
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000401',
  'RELATION-WORKSHOP',
  'Relation workshop'
);

insert into public.role_binding_workshops (tenant_id, binding_id, workshop_id) values (
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000302',
  '71000000-0000-4000-8000-000000000501'
);

insert into public.orders (
  id, enterprise_id, order_no, customer_name, order_flow, from_enterprise_id
) values
  (
    '71000000-0000-4000-8000-000000000601',
    '71000000-0000-4000-8000-000000000001',
    'RELATION-PARENT-A',
    'Same enterprise parent',
    'dealer_to_factory',
    '71000000-0000-4000-8000-000000000001'
  ),
  (
    '72000000-0000-4000-8000-000000000602',
    '72000000-0000-4000-8000-000000000002',
    'RELATION-PARENT-B',
    'Other enterprise parent',
    'factory_to_supplier',
    '72000000-0000-4000-8000-000000000002'
  );

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select throws_ok(
  $$
    select public.create_basic_order(
      '71000000-0000-4000-8000-000000000001',
      '{
        "order_no":"RELATION-SCOPED",
        "order_flow":"dealer_to_factory",
        "parent_order_id":null,
        "customer_name":"Scoped writer",
        "customer_phone":null,
        "customer_address":null,
        "delivery_date":null,
        "remark":null
      }'::jsonb
    )
  $$,
  '42501',
  'ORDER_BASIC_CREATE_FORBIDDEN',
  'workshop-scoped orders.create cannot create enterprise-wide basic orders'
);

reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$
    insert into public.orders (enterprise_id, order_no, customer_name)
    values (
      '71000000-0000-4000-8000-000000000001',
      'RELATION-DIRECT-INSERT',
      'Direct insert'
    )
  $$,
  '42501',
  'permission denied for table orders',
  'authenticated callers cannot directly insert orders'
);

select throws_ok(
  $$
    update public.orders
    set to_enterprise_id = '72000000-0000-4000-8000-000000000002'
    where id = '71000000-0000-4000-8000-000000000601'
  $$,
  '42501',
  'permission denied for table orders',
  'authenticated callers cannot directly update order relationship fields'
);

select throws_ok(
  $$
    select public.create_basic_order(
      '71000000-0000-4000-8000-000000000001',
      '{
        "order_no":"RELATION-WRONG-FLOW",
        "order_flow":"factory_to_supplier",
        "parent_order_id":null,
        "customer_name":"Wrong flow",
        "customer_phone":null,
        "customer_address":null,
        "delivery_date":null,
        "remark":null
      }'::jsonb
    )
  $$,
  '42501',
  'ORDER_BASIC_FLOW_FORBIDDEN',
  'enterprise type fixes the basic-order flow'
);

select throws_ok(
  $$
    select public.create_basic_order(
      '71000000-0000-4000-8000-000000000001',
      '{
        "order_no":"RELATION-CROSS-PARENT",
        "order_flow":"dealer_to_factory",
        "parent_order_id":"72000000-0000-4000-8000-000000000602",
        "customer_name":"Cross enterprise parent",
        "customer_phone":null,
        "customer_address":null,
        "delivery_date":null,
        "remark":null
      }'::jsonb
    )
  $$,
  'P0002',
  'PARENT_ORDER_NOT_FOUND',
  'basic-order parents cannot cross enterprise boundaries'
);

select results_eq(
  $$
    select (value ->> 'order_flow') || ':' || (value ->> 'from_enterprise_id')
    from public.create_basic_order(
      '71000000-0000-4000-8000-000000000001',
      '{
        "order_no":"RELATION-CREATED",
        "order_flow":"dealer_to_factory",
        "parent_order_id":"71000000-0000-4000-8000-000000000601",
        "customer_name":"Created safely",
        "customer_phone":null,
        "customer_address":null,
        "delivery_date":null,
        "remark":null
      }'::jsonb
    ) as created(value)
  $$,
  $$values ('dealer_to_factory:71000000-0000-4000-8000-000000000001')$$,
  'guarded creation derives immutable relationship fields from enterprise context'
);

select throws_ok(
  $$
    select public.create_basic_order(
      '71000000-0000-4000-8000-000000000001',
      '{
        "order_no":"RELATION-CREATED",
        "order_flow":"dealer_to_factory",
        "parent_order_id":null,
        "customer_name":"Duplicate",
        "customer_phone":null,
        "customer_address":null,
        "delivery_date":null,
        "remark":null
      }'::jsonb
    )
  $$,
  '23505',
  'ORDER_NUMBER_CONFLICT',
  'basic-order numbers remain unique inside an enterprise'
);

select * from finish();
rollback;
