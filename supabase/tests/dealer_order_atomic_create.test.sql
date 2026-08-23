begin;

select no_plan();

select has_function(
  'public',
  'create_dealer_order_with_items',
  array['uuid', 'uuid', 'jsonb'],
  'dealer order creation has one transaction boundary'
);

select function_privs_are(
  'public',
  'create_dealer_order_with_items',
  array['uuid', 'uuid', 'jsonb'],
  'authenticated',
  array['EXECUTE'],
  'only authenticated application sessions can invoke dealer order creation'
);

insert into public.enterprises (id, code, name, enterprise_type, status) values
  ('73000000-0000-4000-8000-000000000001', 'atomic-create-dealer', 'Atomic create dealer', 'dealer', 'active'),
  ('73000000-0000-4000-8000-000000000002', 'atomic-create-factory', 'Atomic create factory', 'manufacturer', 'active'),
  ('73000000-0000-4000-8000-000000000003', 'atomic-create-other', 'Atomic create other', 'dealer', 'active');

insert into auth.users (id, email, created_at, updated_at) values
  ('73000000-0000-4000-8000-000000000011', 'dealer-create@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('73000000-0000-4000-8000-000000000101', '73000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000011', 'active', 'Dealer creator');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('73000000-0000-4000-8000-000000000201', '73000000-0000-4000-8000-000000000001', 'atomic_dealer_creator', 'Atomic dealer creator', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('73000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000201', 'orders.create');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('73000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000201', '73000000-0000-4000-8000-000000000101', 'enterprise');

select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select lives_ok(
  $$
    select public.create_dealer_order_with_items(
      '73000000-0000-4000-8000-000000000001',
      '73000000-0000-4000-8000-000000000002',
      '{
        "customer_name":"Atomic customer",
        "customer_phone":"13800000000",
        "delivery_date":"2026-08-30",
        "remark":"created together",
        "items":[
          {"product_name":"Cabinet","specification":"Oak","quantity":2,"unit_price":12.345},
          {"product_name":"Door","specification":null,"quantity":1,"unit_price":0.1}
        ]
      }'::jsonb
    )
  $$,
  'orders.create alone can atomically create a dealer order and its items'
);

select results_eq(
  $$
    select order_row.total_amount, count(item_row.id), sum(item_row.subtotal)
    from public.orders order_row
    join public.order_items item_row
      on item_row.enterprise_id = order_row.enterprise_id
      and item_row.order_id = order_row.id
    where order_row.enterprise_id = '73000000-0000-4000-8000-000000000001'
      and order_row.customer_name = 'Atomic customer'
    group by order_row.total_amount
  $$,
  $$values (2480::numeric, 2::bigint, 2480::numeric)$$,
  'yuan prices are rounded to integer cents and totals are stored in cents'
);

select results_eq(
  $$
    select item_row.product_name, item_row.unit_price, item_row.subtotal
    from public.order_items item_row
    join public.orders order_row
      on order_row.enterprise_id = item_row.enterprise_id
      and order_row.id = item_row.order_id
    where order_row.customer_name = 'Atomic customer'
    order by item_row.sort_order
  $$,
  $$values ('Cabinet'::text, 1235::numeric, 2470::numeric), ('Door'::text, 10::numeric, 10::numeric)$$,
  'each item stores an integer-cent unit price and subtotal'
);

select throws_ok(
  $$
    select public.create_dealer_order_with_items(
      '73000000-0000-4000-8000-000000000003',
      '73000000-0000-4000-8000-000000000002',
      '{"customer_name":"Other tenant","items":[{"product_name":"Desk","quantity":1,"unit_price":1}]}'::jsonb
    )
  $$,
  '42501',
  'DEALER_ORDER_CREATE_FORBIDDEN',
  'an orders.create grant cannot be used outside the active enterprise membership'
);

select throws_ok(
  $$
    select public.create_dealer_order_with_items(
      '73000000-0000-4000-8000-000000000001',
      '73000000-0000-4000-8000-000000000002',
      '{"customer_name":"Atomic rollback","items":[{"product_name":"Oversized","quantity":1000000000000000,"unit_price":0}]}'::jsonb
    )
  $$,
  '22023',
  'DEALER_ORDER_INPUT_INVALID',
  'a child insert failure aborts the complete dealer order transaction'
);

select is(
  (
    select count(*)
    from public.orders
    where enterprise_id = '73000000-0000-4000-8000-000000000001'
      and customer_name = 'Atomic rollback'
  ),
  0::bigint,
  'a failed item insert leaves no parent order behind'
);

reset role;

select * from finish();
rollback;
