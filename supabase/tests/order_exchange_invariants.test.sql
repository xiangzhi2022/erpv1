begin;

select no_plan();

insert into public.enterprises (id, code, name, enterprise_type) values
  ('81000000-0000-4000-8000-000000000001', 'exchange-sender', 'Exchange sender', 'dealer'),
  ('82000000-0000-4000-8000-000000000002', 'exchange-receiver', 'Exchange receiver', 'manufacturer'),
  ('83000000-0000-4000-8000-000000000003', 'exchange-other', 'Exchange other', 'manufacturer');

insert into auth.users (id, email, created_at, updated_at) values
  ('81000000-0000-4000-8000-000000000011', 'exchange-sender@example.invalid', now(), now()),
  ('82000000-0000-4000-8000-000000000012', 'exchange-receiver@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('81000000-0000-4000-8000-000000000101', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000011', 'active', 'Exchange sender'),
  ('82000000-0000-4000-8000-000000000102', '82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000012', 'active', 'Exchange receiver');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('81000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000001', 'exchange_sender', 'Exchange sender', false),
  ('82000000-0000-4000-8000-000000000202', '82000000-0000-4000-8000-000000000002', 'exchange_receiver', 'Exchange receiver', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000201', 'orders.submit'),
  ('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000201', 'orders.update'),
  ('82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000202', 'orders.read'),
  ('82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000202', 'orders.accept');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000201', '81000000-0000-4000-8000-000000000101', 'enterprise'),
  ('82000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000202', '82000000-0000-4000-8000-000000000102', 'enterprise');

insert into public.orders (
  id, enterprise_id, order_no, customer_name, status, order_flow,
  from_enterprise_id, to_enterprise_id, target_factory_id, created_by
) values
  (
    '81000000-0000-4000-8000-000000000301',
    '81000000-0000-4000-8000-000000000001',
    'EXCHANGE-PENDING', 'Pending exchange order', 'pending', 'dealer_to_factory',
    '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000011'
  ),
  (
    '81000000-0000-4000-8000-000000000302',
    '81000000-0000-4000-8000-000000000001',
    'EXCHANGE-CONFIRMED', 'Confirmed exchange order', 'confirmed', 'dealer_to_factory',
    '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000011'
  );

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$select * from public.create_order_exchange(
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000301',
    '83000000-0000-4000-8000-000000000003', null, null
  )$$,
  '22023',
  'ORDER_EXCHANGE_TARGET_MISMATCH',
  'an exchange cannot override the recipient bound to the order'
);

select throws_ok(
  $$select * from public.create_order_exchange(
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000302',
    '82000000-0000-4000-8000-000000000002', null, null
  )$$,
  'P0001',
  'ORDER_EXCHANGE_ORDER_STATUS_CONFLICT',
  'only pending orders can be sent'
);

select results_eq(
  $$select status from public.create_order_exchange(
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000301',
    '82000000-0000-4000-8000-000000000002', 'first send', null
  )$$,
  $$values ('sent'::text)$$,
  'a pending order can be sent to its bound recipient'
);

select throws_ok(
  $$select * from public.create_order_exchange(
    '81000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000301',
    '82000000-0000-4000-8000-000000000002', 'duplicate send', null
  )$$,
  'P0001',
  'ORDER_EXCHANGE_ACTIVE_EXISTS',
  'an order cannot have two active exchanges'
);

reset role;
select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select results_eq(
  $$
    select status
    from public.transition_order_exchange(
      (
        select id from public.order_exchanges
        where enterprise_id = '81000000-0000-4000-8000-000000000001'
          and order_id = '81000000-0000-4000-8000-000000000301'
      ),
      'accept',
      'receiver acceptance',
      null
    )
  $$,
  $$values ('accepted'::text)$$,
  'the receiver accepts the legal sender-owned exchange directly'
);

reset role;

select is(
  (
    select status from public.order_exchanges
    where enterprise_id = '81000000-0000-4000-8000-000000000001'
      and order_id = '81000000-0000-4000-8000-000000000301'
  ),
  'accepted',
  'receiver acceptance persists on the sender-owned exchange'
);

select * from finish();

rollback;
