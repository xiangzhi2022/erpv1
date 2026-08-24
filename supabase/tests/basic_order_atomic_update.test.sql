begin;

select no_plan();

select ok(
  has_function_privilege(
    'authenticated',
    'public.update_basic_order(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated callers can execute the guarded basic-order RPC'
);

insert into public.enterprises (id, code, name, enterprise_type) values (
  '66000000-0000-4000-8000-000000000001',
  'basic-order-atomic',
  'Basic order atomic',
  'dealer'
);

insert into auth.users (id, email, created_at, updated_at) values (
  '66000000-0000-4000-8000-000000000011',
  'basic-order-atomic@example.invalid',
  now(),
  now()
);

insert into public.enterprise_memberships (
  id, tenant_id, user_id, status, display_name
) values (
  '66000000-0000-4000-8000-000000000101',
  '66000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000011',
  'active',
  'Basic order writer'
);

insert into public.roles (id, tenant_id, code, name, is_system) values (
  '66000000-0000-4000-8000-000000000201',
  '66000000-0000-4000-8000-000000000001',
  'basic_order_writer',
  'Basic order writer',
  false
);

insert into public.role_permissions (tenant_id, role_id, permission_code) values (
  '66000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000201',
  'orders.update'
);

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values (
  '66000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000201',
  '66000000-0000-4000-8000-000000000101',
  'enterprise'
);

insert into public.orders (
  id, enterprise_id, order_no, customer_name, status, total_amount
) values (
  '66000000-0000-4000-8000-000000000301',
  '66000000-0000-4000-8000-000000000001',
  'BASIC-ATOMIC-001',
  'Original customer',
  'confirmed',
  0
);

insert into auth.users (id, email, created_at, updated_at) values (
  '66000000-0000-4000-8000-000000000012',
  'basic-order-scoped@example.invalid',
  now(),
  now()
);

insert into public.enterprise_memberships (
  id, tenant_id, user_id, status, display_name
) values (
  '66000000-0000-4000-8000-000000000102',
  '66000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000012',
  'active',
  'Workshop-scoped writer'
);

insert into public.sites (id, tenant_id, code, name, site_type) values (
  '66000000-0000-4000-8000-000000000401',
  '66000000-0000-4000-8000-000000000001',
  'BASIC-SITE',
  'Basic order site',
  'factory'
);

insert into public.workshops (id, tenant_id, site_id, code, name) values (
  '66000000-0000-4000-8000-000000000501',
  '66000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000401',
  'BASIC-WORKSHOP',
  'Basic order workshop'
);

insert into public.role_bindings (
  id, tenant_id, role_id, membership_id, scope_kind
) values (
  '66000000-0000-4000-8000-000000000601',
  '66000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000201',
  '66000000-0000-4000-8000-000000000102',
  'workshops'
);

insert into public.role_binding_workshops (
  tenant_id, binding_id, workshop_id
) values (
  '66000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000601',
  '66000000-0000-4000-8000-000000000501'
);

select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-4000-8000-000000000012',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.update_basic_order(
      '66000000-0000-4000-8000-000000000001',
      '66000000-0000-4000-8000-000000000301',
      '{
        "order_no":"BASIC-SCOPED-002",
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
  'ORDER_UPDATE_FORBIDDEN',
  'workshop-scoped orders.update cannot mutate enterprise-wide basic order fields'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '66000000-0000-4000-8000-000000000011',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select public.update_basic_order(
      '66000000-0000-4000-8000-000000000001',
      '66000000-0000-4000-8000-000000000301',
      '{
        "order_no":"BASIC-ATOMIC-002",
        "order_flow":"dealer_to_factory",
        "parent_order_id":null,
        "customer_name":"Partially saved customer",
        "customer_phone":null,
        "customer_address":null,
        "delivery_date":null,
        "remark":null
      }'::jsonb
    )
  $$,
  'P0001',
  'ORDER_STATUS_TRANSITION_INVALID',
  'invalid status reset rejects the complete basic-order update'
);

reset role;

select results_eq(
  $$
    select order_no || ':' || customer_name
    from public.orders
    where enterprise_id = '66000000-0000-4000-8000-000000000001'
      and id = '66000000-0000-4000-8000-000000000301'
  $$,
  $$values ('BASIC-ATOMIC-001:Original customer')$$,
  'basic fields roll back when the status transition fails'
);

select * from finish();
rollback;
