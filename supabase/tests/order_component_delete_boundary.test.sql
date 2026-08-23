begin;

select no_plan();

insert into public.enterprises (id, code, name, enterprise_type) values
  ('78000000-0000-4000-8000-000000000001', 'component-delete-a', 'Component Delete A', 'manufacturer'),
  ('78000000-0000-4000-8000-000000000002', 'component-delete-b', 'Component Delete B', 'manufacturer');

insert into auth.users (id, email, created_at, updated_at) values
  ('78000000-0000-4000-8000-000000000011', 'component-delete-a@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('78000000-0000-4000-8000-000000000101', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000011', 'active', 'Order editor A');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('78000000-0000-4000-8000-000000000201', '78000000-0000-4000-8000-000000000001', 'component_editor', 'Component editor', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000201', 'orders.update');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000201', '78000000-0000-4000-8000-000000000101', 'enterprise');

insert into public.orders (id, enterprise_id, order_no, customer_name, status) values
  ('78000000-0000-4000-8000-000000000301', '78000000-0000-4000-8000-000000000001', 'DELETE-DRAFT', 'Draft customer', 'draft'),
  ('78000000-0000-4000-8000-000000000302', '78000000-0000-4000-8000-000000000001', 'DELETE-ACCEPTED', 'Accepted customer', 'accepted'),
  ('78000000-0000-4000-8000-000000000303', '78000000-0000-4000-8000-000000000002', 'DELETE-OTHER', 'Other customer', 'draft');

insert into public.order_spaces (id, enterprise_id, order_id, space_no, space_name) values
  ('78000000-0000-4000-8000-000000000401', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', 'S-DRAFT', 'Draft space'),
  ('78000000-0000-4000-8000-000000000402', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000302', 'S-ACCEPTED', 'Accepted space'),
  ('78000000-0000-4000-8000-000000000403', '78000000-0000-4000-8000-000000000002', '78000000-0000-4000-8000-000000000303', 'S-OTHER', 'Other space'),
  ('78000000-0000-4000-8000-000000000404', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', 'S-PRODUCT', 'Product space'),
  ('78000000-0000-4000-8000-000000000405', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', 'S-PRODUCING', 'Producing product space');

insert into public.order_products (id, enterprise_id, order_id, space_id, product_no, product_name) values
  ('78000000-0000-4000-8000-000000000501', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', '78000000-0000-4000-8000-000000000401', 'P-CASCADE', 'Cascade product'),
  ('78000000-0000-4000-8000-000000000502', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000302', '78000000-0000-4000-8000-000000000402', 'P-ACCEPTED', 'Accepted product'),
  ('78000000-0000-4000-8000-000000000503', '78000000-0000-4000-8000-000000000002', '78000000-0000-4000-8000-000000000303', '78000000-0000-4000-8000-000000000403', 'P-OTHER', 'Other product'),
  ('78000000-0000-4000-8000-000000000504', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', '78000000-0000-4000-8000-000000000404', 'P-DIRECT', 'Direct product'),
  ('78000000-0000-4000-8000-000000000505', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', '78000000-0000-4000-8000-000000000405', 'P-PRODUCING', 'Producing product');

update public.order_products set status = 'producing'
where id = '78000000-0000-4000-8000-000000000505';

insert into public.order_modules (id, enterprise_id, order_id, module_no, module_name) values
  ('78000000-0000-4000-8000-000000000601', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', 'M-CASCADE', 'Cascade module'),
  ('78000000-0000-4000-8000-000000000602', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', 'M-ITEM', 'Item module');

insert into public.order_items (id, enterprise_id, order_id, module_id, item_no, product_name) values
  ('78000000-0000-4000-8000-000000000701', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', '78000000-0000-4000-8000-000000000601', 'I-CASCADE', 'Cascade item'),
  ('78000000-0000-4000-8000-000000000702', '78000000-0000-4000-8000-000000000001', '78000000-0000-4000-8000-000000000301', '78000000-0000-4000-8000-000000000602', 'I-DIRECT', 'Direct item');

select set_config('request.jwt.claim.sub', '78000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$delete from public.order_spaces where id = '78000000-0000-4000-8000-000000000401'$$,
  '42501',
  'permission denied for table order_spaces',
  'orders.update cannot directly delete spaces'
);

select throws_ok(
  $$delete from public.order_modules where id = '78000000-0000-4000-8000-000000000601'$$,
  '42501',
  'permission denied for table order_modules',
  'orders.update cannot directly delete modules'
);

select throws_ok(
  $$delete from public.order_items where id = '78000000-0000-4000-8000-000000000702'$$,
  '42501',
  'permission denied for table order_items',
  'orders.update cannot directly delete items'
);

select throws_ok(
  $$delete from public.order_products where id = '78000000-0000-4000-8000-000000000504'$$,
  '42501',
  'permission denied for table order_products',
  'orders.update cannot directly delete products'
);

select throws_ok(
  $$select public.delete_order_component('78000000-0000-4000-8000-000000000001', 'product', '78000000-0000-4000-8000-000000000502')$$,
  'P0001',
  'ORDER_COMPONENT_DELETE_STATUS_CONFLICT',
  'accepted order components cannot be deleted through the RPC'
);

select throws_ok(
  $$select public.delete_order_component('78000000-0000-4000-8000-000000000001', 'product', '78000000-0000-4000-8000-000000000505')$$,
  'P0001',
  'ORDER_COMPONENT_DELETE_STATUS_CONFLICT',
  'a producing product cannot be deleted even while its parent order is draft'
);

select throws_ok(
  $$select public.delete_order_component('78000000-0000-4000-8000-000000000001', 'space', '78000000-0000-4000-8000-000000000405')$$,
  'P0001',
  'ORDER_COMPONENT_DELETE_STATUS_CONFLICT',
  'space cascade refuses to delete a producing descendant product'
);

select throws_ok(
  $$select public.delete_order_component('78000000-0000-4000-8000-000000000002', 'product', '78000000-0000-4000-8000-000000000503')$$,
  '42501',
  'ORDER_COMPONENT_DELETE_FORBIDDEN',
  'component deletion cannot cross the enterprise boundary'
);

select is(
  public.delete_order_component(
    '78000000-0000-4000-8000-000000000001',
    'product',
    '78000000-0000-4000-8000-000000000504'
  ) ->> 'id',
  '78000000-0000-4000-8000-000000000504',
  'editable-order product deletion returns a narrow acknowledgement'
);

select is(
  public.delete_order_component(
    '78000000-0000-4000-8000-000000000001',
    'item',
    '78000000-0000-4000-8000-000000000702'
  ) ->> 'id',
  '78000000-0000-4000-8000-000000000702',
  'editable-order item deletion is supported by the guarded RPC'
);

select is(
  public.delete_order_component(
    '78000000-0000-4000-8000-000000000001',
    'space',
    '78000000-0000-4000-8000-000000000401'
  ) ->> 'id',
  '78000000-0000-4000-8000-000000000401',
  'editable-order space deletion is supported by the guarded RPC'
);

select is(
  public.delete_order_component(
    '78000000-0000-4000-8000-000000000001',
    'module',
    '78000000-0000-4000-8000-000000000601'
  ) ->> 'id',
  '78000000-0000-4000-8000-000000000601',
  'editable-order module deletion is supported by the guarded RPC'
);

reset role;

select is(
  (select count(*) from public.order_products where id in (
    '78000000-0000-4000-8000-000000000501',
    '78000000-0000-4000-8000-000000000504'
  )),
  0::bigint,
  'product deletion is exact and space deletion cascades to its products'
);

select is(
  (select count(*) from public.order_items where id in (
    '78000000-0000-4000-8000-000000000701',
    '78000000-0000-4000-8000-000000000702'
  )),
  0::bigint,
  'item deletion is exact and module deletion cascades to its items'
);

select is(
  (select count(*) from public.order_status_logs
   where enterprise_id = '78000000-0000-4000-8000-000000000001'
     and target_id in (
       '78000000-0000-4000-8000-000000000401',
       '78000000-0000-4000-8000-000000000504',
       '78000000-0000-4000-8000-000000000601',
       '78000000-0000-4000-8000-000000000702'
     )
     and to_status = 'deleted'),
  4::bigint,
  'each guarded component deletion writes an audit record'
);

select * from finish();
rollback;
