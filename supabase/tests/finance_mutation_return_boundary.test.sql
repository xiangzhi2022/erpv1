begin;

select no_plan();

insert into public.enterprises (id, code, name, enterprise_type) values
  ('76000000-0000-4000-8000-000000000001', 'finance-mutation-return', 'Finance Mutation Return', 'manufacturer');

insert into auth.users (id, email, created_at, updated_at) values
  ('76000000-0000-4000-8000-000000000011', 'finance-mutation-return@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('76000000-0000-4000-8000-000000000101', '76000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000011', 'active', 'Mutation-only finance');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('76000000-0000-4000-8000-000000000201', '76000000-0000-4000-8000-000000000001', 'finance_mutation_only', 'Finance mutation only', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('76000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000201', 'finance.manage');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('76000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000201', '76000000-0000-4000-8000-000000000101', 'enterprise');

insert into public.orders (
  id, enterprise_id, order_no, customer_name, status,
  total_amount, cost_amount, profit_amount, deposit_amount, internal_remark
) values (
  '76000000-0000-4000-8000-000000000301',
  '76000000-0000-4000-8000-000000000001',
  'FIN-MUT-RETURN',
  'Sensitive customer',
  'pending',
  10000,
  6000,
  4000,
  1000,
  'sensitive order remark'
);

insert into public.order_spaces (id, enterprise_id, order_id, space_no, space_name) values (
  '76000000-0000-4000-8000-000000000401',
  '76000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000301',
  'S-1',
  'Sensitive space'
);

insert into public.order_products (
  id, enterprise_id, order_id, space_id, product_no, product_name,
  quoted_amount, cost_amount, profit_amount, internal_remark
) values (
  '76000000-0000-4000-8000-000000000501',
  '76000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000301',
  '76000000-0000-4000-8000-000000000401',
  'P-1',
  'Sensitive product',
  10000,
  6000,
  4000,
  'sensitive product remark'
);

insert into public.order_items (
  id, enterprise_id, order_id, item_no, product_name, unit_price, subtotal
) values (
  '76000000-0000-4000-8000-000000000601',
  '76000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000301',
  'I-1',
  'Sensitive item',
  10000,
  10000
);

select set_config('request.jwt.claim.sub', '76000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$select * from public.finance_update_order_pricing(
    '76000000-0000-4000-8000-000000000001',
    '76000000-0000-4000-8000-000000000301',
    'NaN'::numeric, null, null, null
  )$$,
  '22023',
  'invalid cents amount',
  'order pricing rejects NaN before it reaches financial columns'
);

select throws_ok(
  $$select * from public.finance_update_order_product(
    '76000000-0000-4000-8000-000000000001',
    '76000000-0000-4000-8000-000000000501',
    'Infinity'::numeric, null, null, null, false
  )$$,
  '22023',
  'INVALID_CENTS_AMOUNT',
  'product pricing rejects infinite numeric values'
);

select throws_ok(
  $$select * from public.finance_update_order_item_pricing(
    '76000000-0000-4000-8000-000000000001',
    '76000000-0000-4000-8000-000000000601',
    'NaN'::numeric, null
  )$$,
  '22023',
  'INVALID_CENTS_AMOUNT',
  'item pricing rejects NaN before it reaches financial columns'
);

select results_eq(
  $$
    select key
    from (
      select * from public.finance_update_order_pricing(
        '76000000-0000-4000-8000-000000000001',
        '76000000-0000-4000-8000-000000000301',
        12500, null, null, null
      )
    ) as acknowledgement
    cross join lateral jsonb_object_keys(to_jsonb(acknowledgement)) as key
  $$,
  $$values ('id'::text)$$,
  'finance.manage without finance.read receives only an order identifier acknowledgement'
);

select results_eq(
  $$
    select key
    from (
      select * from public.finance_update_order_product(
        '76000000-0000-4000-8000-000000000001',
        '76000000-0000-4000-8000-000000000501',
        12500, null, null, null, false
      )
    ) as acknowledgement
    cross join lateral jsonb_object_keys(to_jsonb(acknowledgement)) as key
  $$,
  $$values ('id'::text)$$,
  'finance.manage without finance.read receives only a product identifier acknowledgement'
);

select results_eq(
  $$
    select key
    from (
      select * from public.finance_update_order_item_pricing(
        '76000000-0000-4000-8000-000000000001',
        '76000000-0000-4000-8000-000000000601',
        12500, null
      )
    ) as acknowledgement
    cross join lateral jsonb_object_keys(to_jsonb(acknowledgement)) as key
  $$,
  $$values ('id'::text)$$,
  'finance.manage without finance.read receives only an item identifier acknowledgement'
);

select results_eq(
  $$
    select key
    from (
      select * from public.update_order_internal_remark(
        '76000000-0000-4000-8000-000000000001',
        '76000000-0000-4000-8000-000000000301',
        'updated mutation-only remark'
      )
    ) as acknowledgement
    cross join lateral jsonb_object_keys(to_jsonb(acknowledgement)) as key
  $$,
  $$values ('id'::text)$$,
  'finance.manage without finance.read receives only an internal-remark mutation acknowledgement'
);

reset role;

select is(
  (select total_amount from public.orders where id = '76000000-0000-4000-8000-000000000301'),
  12500::numeric,
  'identifier-only acknowledgement still performs the pricing update'
);

select is(
  (select quoted_amount from public.order_products where id = '76000000-0000-4000-8000-000000000501'),
  12500::numeric,
  'identifier-only acknowledgement still performs the product pricing update'
);

select is(
  (select unit_price from public.order_items where id = '76000000-0000-4000-8000-000000000601'),
  12500::numeric,
  'identifier-only acknowledgement still performs the item pricing update'
);

select is(
  (select internal_remark from public.orders where id = '76000000-0000-4000-8000-000000000301'),
  'updated mutation-only remark'::text,
  'identifier-only acknowledgement still performs the internal remark update'
);

select * from finish();
rollback;
