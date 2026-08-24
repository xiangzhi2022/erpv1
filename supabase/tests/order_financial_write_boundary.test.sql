begin;

select no_plan();

select ok(
  not has_column_privilege('authenticated', 'public.orders', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.orders', 'internal_remark', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'internal_remark', 'INSERT')
  and not has_column_privilege('authenticated', 'public.order_products', 'quoted_amount', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.order_products', 'cost_amount', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.order_products', 'profit_amount', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.order_products', 'internal_remark', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.order_products', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.order_items', 'unit_price', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.order_items', 'subtotal', 'UPDATE'),
  'authenticated callers cannot directly update sensitive order detail columns'
);

select ok(
  has_column_privilege('authenticated', 'public.orders', 'customer_name', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.order_products', 'product_name', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.order_items', 'product_name', 'UPDATE'),
  'authenticated callers retain basic order updates while component writes remain RPC-only'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_order_product_with_pricing(uuid,uuid,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.create_order_item_with_pricing(uuid,uuid,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.finance_update_order_product(uuid,uuid,numeric,numeric,numeric,text,boolean)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.finance_update_order_item_pricing(uuid,uuid,numeric,numeric)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.update_order_internal_remark(uuid,uuid,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.transition_order_status(uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  'authenticated callers can execute the guarded order write RPCs'
);

insert into public.enterprises (id, code, name, enterprise_type) values
  ('61000000-0000-4000-8000-000000000001', 'financial-write-a', 'Financial write A', 'manufacturer'),
  ('62000000-0000-4000-8000-000000000002', 'financial-write-b', 'Financial write B', 'manufacturer');

insert into auth.users (id, email, created_at, updated_at) values
  ('61000000-0000-4000-8000-000000000011', 'financial-a@example.invalid', now(), now()),
  ('62000000-0000-4000-8000-000000000012', 'financial-b@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('61000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000011', 'active', 'Finance A'),
  ('62000000-0000-4000-8000-000000000102', '62000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000012', 'active', 'Orders B');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('61000000-0000-4000-8000-000000000201', '61000000-0000-4000-8000-000000000001', 'financial_writer', 'Financial writer', false),
  ('62000000-0000-4000-8000-000000000202', '62000000-0000-4000-8000-000000000002', 'order_writer', 'Order writer', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000201', 'finance.manage'),
  ('61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000201', 'orders.update'),
  ('62000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000202', 'orders.create'),
  ('62000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000202', 'orders.update');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000201', '61000000-0000-4000-8000-000000000101', 'enterprise'),
  ('62000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000202', '62000000-0000-4000-8000-000000000102', 'enterprise');

insert into public.orders (
  id, enterprise_id, order_no, customer_name, status, total_amount, internal_remark
) values
  ('61000000-0000-4000-8000-000000000301', '61000000-0000-4000-8000-000000000001', 'FIN-WRITE-A', 'Customer A', 'pending', 10000, 'old A'),
  ('61000000-0000-4000-8000-000000000303', '61000000-0000-4000-8000-000000000001', 'FIN-WRITE-A2', 'Customer A2', 'pending', 10000, 'old A2'),
  ('62000000-0000-4000-8000-000000000302', '62000000-0000-4000-8000-000000000002', 'FIN-WRITE-B', 'Customer B', 'pending', 20000, 'old B');

update public.orders
set created_by = '62000000-0000-4000-8000-000000000012'
where id = '62000000-0000-4000-8000-000000000302';

insert into public.order_spaces (
  id, enterprise_id, order_id, space_no, space_name
) values
  ('61000000-0000-4000-8000-000000000401', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000301', 'S-1', 'Space A'),
  ('61000000-0000-4000-8000-000000000403', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000303', 'S-3', 'Space A2'),
  ('62000000-0000-4000-8000-000000000402', '62000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000302', 'S-2', 'Space B');

insert into public.order_modules (
  id, enterprise_id, order_id, module_no, module_name
) values (
  '61000000-0000-4000-8000-000000000404',
  '61000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000303',
  'M-3',
  'Module A2'
);

insert into public.order_products (
  id, enterprise_id, order_id, space_id, product_no, product_name, quoted_amount, cost_amount, profit_amount
) values
  ('61000000-0000-4000-8000-000000000501', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000301', '61000000-0000-4000-8000-000000000401', 'P-1', 'Product A', 10000, 6000, 4000),
  ('62000000-0000-4000-8000-000000000502', '62000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000302', '62000000-0000-4000-8000-000000000402', 'P-2', 'Product B', 20000, 12000, 8000);

insert into public.order_items (
  id, enterprise_id, order_id, item_no, product_name, unit_price, subtotal
) values
  ('61000000-0000-4000-8000-000000000601', '61000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000301', 'I-1', 'Item A', 10000, 10000),
  ('62000000-0000-4000-8000-000000000602', '62000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000302', 'I-2', 'Item B', 20000, 20000);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$
    insert into public.orders (
      enterprise_id, order_no, customer_name, status, total_amount
    ) values (
      '61000000-0000-4000-8000-000000000001',
      'ORDER-STATUS-BYPASS',
      'Bypass customer',
      'completed',
      1
    )
  $$,
  '42501',
  'permission denied for table orders',
  'orders.create cannot insert a terminal workflow status directly'
);

select throws_ok(
  $$update public.order_products set cost_amount = 1 where id = '61000000-0000-4000-8000-000000000501'$$,
  '42501',
  'permission denied for table order_products',
  'orders.update cannot directly overwrite product finance columns'
);

select throws_ok(
  $$update public.order_items set unit_price = 1 where id = '61000000-0000-4000-8000-000000000601'$$,
  '42501',
  'permission denied for table order_items',
  'orders.update cannot directly overwrite item pricing columns'
);

select throws_ok(
  $$
    insert into public.order_products (
      enterprise_id, order_id, space_id, product_no, product_name, quoted_amount
    ) values (
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000301',
      '61000000-0000-4000-8000-000000000401',
      'P-BYPASS',
      'Bypass product',
      1
    )
  $$,
  '42501',
  'permission denied for table order_products',
  'orders.update cannot insert product pricing directly'
);

select throws_ok(
  $$
    insert into public.order_items (
      enterprise_id, order_id, item_no, product_name, unit_price, subtotal
    ) values (
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000301',
      'I-BYPASS',
      'Bypass item',
      1,
      1
    )
  $$,
  '42501',
  'permission denied for table order_items',
  'orders.update cannot insert item pricing directly'
);

select results_eq(
  $$
    select id
    from public.finance_update_order_product(
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000501',
      12500,
      null,
      null,
      'reviewed',
      true
    )
  $$,
  $$values ('61000000-0000-4000-8000-000000000501'::uuid)$$,
  'finance users receive an identifier acknowledgement after updating product pricing'
);

select results_eq(
  $$
    select id
    from public.finance_update_order_item_pricing(
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000601',
      12500,
      12500
    )
  $$,
  $$values ('61000000-0000-4000-8000-000000000601'::uuid)$$,
  'finance users receive an identifier acknowledgement after updating item pricing'
);

select throws_ok(
  $$
    select *
    from public.create_order_product_with_pricing(
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000301',
      '{
        "space_id":"61000000-0000-4000-8000-000000000403",
        "product_no":"P-WRONG-ORDER",
        "product_name":"Wrong order space",
        "quoted_amount":100
      }'::jsonb
    )
  $$,
  'P0002',
  'ORDER_PRODUCT_SPACE_NOT_FOUND',
  'product creation rejects a space belonging to another order'
);

select throws_ok(
  $$
    select *
    from public.create_order_item_with_pricing(
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000301',
      '{
        "module_id":"61000000-0000-4000-8000-000000000404",
        "item_no":"I-WRONG-ORDER",
        "product_name":"Wrong order module",
        "unit_price":100,
        "subtotal":100
      }'::jsonb
    )
  $$,
  'P0002',
  'ORDER_ITEM_MODULE_NOT_FOUND',
  'item creation rejects a module belonging to another order'
);

select throws_ok(
  $$
    select *
    from public.finance_update_order_product(
      '62000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000502',
      1,
      null,
      null,
      null,
      false
    )
  $$,
  '42501',
  'ORDER_PRODUCT_FINANCE_FORBIDDEN',
  'finance RPC rejects cross-enterprise writes'
);

reset role;
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.create_order_product_with_pricing(
      '62000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000302',
      '{
        "space_id":"62000000-0000-4000-8000-000000000402",
        "product_no":"P-CREATOR-BYPASS",
        "product_name":"Creator bypass",
        "quoted_amount":100,
        "cost_amount":1,
        "profit_amount":99,
        "internal_remark":"hidden"
      }'::jsonb
    )
  $$,
  '42501',
  'ORDER_PRODUCT_FINANCE_FORBIDDEN',
  'order creators cannot initialize internal finance-only product fields'
);

select throws_ok(
  $$
    select *
    from public.create_order_product_with_pricing(
      '62000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000302',
      '{
        "space_id":"62000000-0000-4000-8000-000000000402",
        "product_no":"P-STATUS-BYPASS",
        "product_name":"Status bypass",
        "status":"completed",
        "quoted_amount":100
      }'::jsonb
    )
  $$,
  '22023',
  'ORDER_PRODUCT_INPUT_INVALID',
  'order creators cannot insert products in terminal workflow states'
);

reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select results_eq(
  $$
    select id
    from public.update_order_internal_remark(
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000301',
      'new A'
    )
  $$,
  $$values ('61000000-0000-4000-8000-000000000301'::uuid)$$,
  'internal order remark updates return only an identifier acknowledgement'
);

select results_eq(
  $$
    select status
    from public.transition_order_status(
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000301',
      'pending',
      'cancelled',
      'customer cancelled'
    )
  $$,
  $$values ('cancelled'::text)$$,
  'order writers transition ordinary statuses through the guarded RPC'
);

reset role;
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select throws_ok(
  $$
    select *
    from public.transition_order_status(
      '62000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000302',
      'pending',
      'completed',
      'skip workflow'
    )
  $$,
  'P0001',
  'ORDER_STATUS_TRANSITION_INVALID',
  'order writers cannot skip the status transition graph'
);

reset role;
select is(
  (
    select count(*)
    from public.order_status_logs
    where enterprise_id = '62000000-0000-4000-8000-000000000002'
      and target_id = '62000000-0000-4000-8000-000000000302'
  ),
  0::bigint,
  'rejected transitions do not create status logs'
);

set local role authenticated;
select throws_ok(
  $$
    select *
    from public.transition_order_status(
      '62000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000302',
      'pending',
      'pending',
      null
    )
  $$,
  'P0001',
  'ORDER_STATUS_TRANSITION_INVALID',
  'status RPC rejects no-op reads through its definer boundary'
);

reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000011', true);

select results_eq(
  $$
    select from_status, to_status, remark
    from public.order_status_logs
    where enterprise_id = '61000000-0000-4000-8000-000000000001'
      and target_id = '61000000-0000-4000-8000-000000000301'
  $$,
  $$values ('pending'::text, 'cancelled'::text, 'customer cancelled'::text)$$,
  'status RPC records its transition atomically'
);

set local role authenticated;
select throws_ok(
  $$
    select *
    from public.transition_order_status(
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000301',
      'pending',
      'draft',
      null
    )
  $$,
  'P0001',
  'ORDER_STATUS_CONFLICT',
  'status RPC rejects stale expected state'
);

reset role;

insert into public.order_exchanges (
  id, enterprise_id, order_id, from_enterprise_id, to_enterprise_id,
  from_user_id, status
) values (
  '61000000-0000-4000-8000-000000000701',
  '61000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000303',
  '61000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002',
  '61000000-0000-4000-8000-000000000011',
  'sent'
);

create function pg_temp.reject_exchange_update()
returns trigger language plpgsql as $$
begin
  raise exception 'TEST_EXCHANGE_FAILURE';
end;
$$;
create trigger reject_exchange_update
before update on public.order_exchanges
for each row
when (old.id = '61000000-0000-4000-8000-000000000701')
execute function pg_temp.reject_exchange_update();

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$select public.transition_order_status_with_exchanges(
    '61000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000303',
    'pending',
    'cancelled',
    'atomic rollback test'
  )$$,
  'P0001',
  'TEST_EXCHANGE_FAILURE',
  'exchange failure aborts the surrounding order status transition'
);

reset role;
select is(
  (select status from public.orders where id = '61000000-0000-4000-8000-000000000303'),
  'pending',
  'failed exchange side effect leaves the order status unchanged'
);
select is(
  (select count(*) from public.order_status_logs
   where target_id = '61000000-0000-4000-8000-000000000303'),
  0::bigint,
  'failed exchange side effect leaves no order status audit row'
);

select * from finish();

rollback;
