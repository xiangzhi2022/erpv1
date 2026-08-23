begin;
select no_plan();

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.create_order_product_with_pricing_internal(uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated callers cannot execute the order-tree-only product helper'
);

insert into public.enterprises (id, code, name, enterprise_type) values
  ('79000000-0000-4000-8000-000000000001', 'component-write', 'Component Write', 'manufacturer');
insert into auth.users (id, email, created_at, updated_at) values
  ('79000000-0000-4000-8000-000000000011', 'component-write@example.invalid', now(), now()),
  ('79000000-0000-4000-8000-000000000012', 'component-update-only@example.invalid', now(), now());
insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('79000000-0000-4000-8000-000000000101', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000011', 'active', 'Component editor'),
  ('79000000-0000-4000-8000-000000000102', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000012', 'active', 'Update-only editor');
insert into public.roles (id, tenant_id, code, name, is_system) values
  ('79000000-0000-4000-8000-000000000201', '79000000-0000-4000-8000-000000000001', 'component_writer', 'Component writer', false),
  ('79000000-0000-4000-8000-000000000202', '79000000-0000-4000-8000-000000000001', 'component_update_only', 'Component update only', false);
insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000201', 'orders.update'),
  ('79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000201', 'orders.create'),
  ('79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000202', 'orders.update');
insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000201', '79000000-0000-4000-8000-000000000101', 'enterprise'),
  ('79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000202', '79000000-0000-4000-8000-000000000102', 'enterprise');

insert into public.orders (id, enterprise_id, order_no, customer_name, status) values
  ('79000000-0000-4000-8000-000000000301', '79000000-0000-4000-8000-000000000001', 'WRITE-DRAFT-A', 'Draft A', 'draft'),
  ('79000000-0000-4000-8000-000000000302', '79000000-0000-4000-8000-000000000001', 'WRITE-DRAFT-B', 'Draft B', 'draft'),
  ('79000000-0000-4000-8000-000000000303', '79000000-0000-4000-8000-000000000001', 'WRITE-DONE', 'Completed', 'completed');
update public.orders set created_by = '79000000-0000-4000-8000-000000000011'
where id = '79000000-0000-4000-8000-000000000301';
insert into public.order_spaces (id, enterprise_id, order_id, space_no, space_name) values
  ('79000000-0000-4000-8000-000000000401', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000301', 'A-S1', 'Draft space A'),
  ('79000000-0000-4000-8000-000000000402', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000302', 'B-S1', 'Draft space B'),
  ('79000000-0000-4000-8000-000000000403', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000303', 'D-S1', 'Done space'),
  ('79000000-0000-4000-8000-000000000404', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000301', 'A-S2', 'Confirmed space');
update public.order_spaces set status = 'confirmed' where id = '79000000-0000-4000-8000-000000000404';
insert into public.order_modules (id, enterprise_id, order_id, module_no, module_name) values
  ('79000000-0000-4000-8000-000000000501', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000301', 'A-M1', 'Draft module A'),
  ('79000000-0000-4000-8000-000000000502', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000302', 'B-M1', 'Draft module B');
insert into public.order_products (id, enterprise_id, order_id, space_id, product_no, product_name) values
  ('79000000-0000-4000-8000-000000000601', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000301', '79000000-0000-4000-8000-000000000401', 'A-P1', 'Draft product'),
  ('79000000-0000-4000-8000-000000000602', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000301', '79000000-0000-4000-8000-000000000401', 'A-P2', 'Producing product');
update public.order_products set status = 'producing' where id = '79000000-0000-4000-8000-000000000602';
insert into public.order_items (id, enterprise_id, order_id, module_id, item_no, product_name) values
  ('79000000-0000-4000-8000-000000000701', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000301', '79000000-0000-4000-8000-000000000501', 'A-I1', 'Draft item');
insert into public.order_item_attachments (id, enterprise_id, order_id, module_id, order_item_id, file_name, file_path, file_url) values
  ('79000000-0000-4000-8000-000000000801', '79000000-0000-4000-8000-000000000001', '79000000-0000-4000-8000-000000000301', '79000000-0000-4000-8000-000000000501', '79000000-0000-4000-8000-000000000701', 'a.pdf', 'a.pdf', 'https://invalid.example/a.pdf');

select set_config('request.jwt.claim.sub', '79000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok($$insert into public.order_spaces (enterprise_id,order_id,space_no,space_name) values ('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000303','BYPASS','Bypass')$$, '42501', 'permission denied for table order_spaces', 'direct finalized-order space insert is denied');
select throws_ok($$insert into public.order_modules (enterprise_id,order_id,module_no,module_name) values ('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000303','BYPASS','Bypass')$$, '42501', 'permission denied for table order_modules', 'direct finalized-order module insert is denied');
select throws_ok($$insert into public.order_products (enterprise_id,order_id,space_id,product_no,product_name) values ('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000303','79000000-0000-4000-8000-000000000403','BYPASS','Bypass')$$, '42501', 'permission denied for table order_products', 'direct finalized-order product insert is denied');
select throws_ok($$insert into public.order_items (enterprise_id,order_id,item_no,product_name) values ('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000303','BYPASS','Bypass')$$, '42501', 'permission denied for table order_items', 'direct finalized-order item insert is denied');
select throws_ok($$update public.order_spaces set space_name = 'Bypass' where id = '79000000-0000-4000-8000-000000000401'$$, '42501', 'permission denied for table order_spaces', 'direct space update is denied');
select throws_ok($$update public.order_products set order_id = '79000000-0000-4000-8000-000000000302', space_id = '79000000-0000-4000-8000-000000000402' where id = '79000000-0000-4000-8000-000000000601'$$, '42501', 'permission denied for table order_products', 'direct product reparent is denied');
select throws_ok($$update public.order_items set module_id = '79000000-0000-4000-8000-000000000502' where id = '79000000-0000-4000-8000-000000000701'$$, '42501', 'permission denied for table order_items', 'direct item reparent is denied');
select throws_ok($$update public.order_modules set module_name = 'Bypass' where id = '79000000-0000-4000-8000-000000000501'$$, '42501', 'permission denied for table order_modules', 'direct module update is denied');
select throws_ok($$update public.order_item_attachments set order_id = '79000000-0000-4000-8000-000000000302' where id = '79000000-0000-4000-8000-000000000801'$$, '42501', 'permission denied for table order_item_attachments', 'direct attachment reparent is denied');
select throws_ok($$insert into public.order_item_attachments (enterprise_id,order_id,order_item_id,file_name,file_path,file_url) values ('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','79000000-0000-4000-8000-000000000701','b.pdf','b.pdf','https://invalid.example/b.pdf')$$, '42501', 'permission denied for table order_item_attachments', 'direct attachment insert is denied');
select throws_ok($$delete from public.order_item_attachments where id = '79000000-0000-4000-8000-000000000801'$$, '42501', 'permission denied for table order_item_attachments', 'direct attachment delete is denied');

select throws_ok($$select public.create_order_space('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000303','{"space_name":"late"}'::jsonb)$$, 'P0001', 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT', 'finalized order cannot create a space');
select throws_ok($$select public.create_order_product_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"space_id":"79000000-0000-4000-8000-000000000402","product_name":"wrong"}'::jsonb)$$, 'P0002', 'ORDER_PRODUCT_SPACE_NOT_FOUND', 'product creation rejects a space from another order');
select throws_ok($$select public.create_order_item_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"module_id":"79000000-0000-4000-8000-000000000502","product_name":"wrong"}'::jsonb)$$, 'P0002', 'ORDER_ITEM_MODULE_NOT_FOUND', 'item creation rejects a module from another order');
select throws_ok($$select public.create_order_product_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"space_id":"79000000-0000-4000-8000-000000000401","product_name":"priced","cost_amount":1}'::jsonb)$$, '42501', 'ORDER_PRODUCT_FINANCE_FORBIDDEN', 'internal finance fields require finance.manage');
select throws_ok($$select public.create_order_product_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"space_id":"79000000-0000-4000-8000-000000000401","product_name":"quoted","quoted_amount":1}'::jsonb)$$, '42501', 'ORDER_PRODUCT_FINANCE_FORBIDDEN', 'quoted amount requires finance.manage on the public RPC');
select throws_ok($$select public.create_order_product_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"space_id":"79000000-0000-4000-8000-000000000404","product_name":"bad space"}'::jsonb)$$, 'P0001', 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT', 'product creation rejects a confirmed space even while the parent order is draft');
select throws_ok($$select public.create_order_product_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"space_id":"79000000-0000-4000-8000-000000000401","product_name":"bad","quantity":0}'::jsonb)$$, '22023', 'ORDER_PRODUCT_INPUT_INVALID', 'product RPC rejects non-positive quantity');
select throws_ok($$select public.create_order_product_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"space_id":"79000000-0000-4000-8000-000000000401","product_name":"bad","width":-1}'::jsonb)$$, '22023', 'ORDER_PRODUCT_INPUT_INVALID', 'product RPC rejects negative dimensions');
select throws_ok($$select public.create_order_item_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"module_id":"79000000-0000-4000-8000-000000000501","product_name":"bad","quantity":0}'::jsonb)$$, '22023', 'ORDER_ITEM_INPUT_INVALID', 'item RPC rejects non-positive quantity');

select ok((public.create_order_space('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"space_name":"合法空间"}'::jsonb)->>'id') is not null, 'draft order can create a space through the RPC');
select ok((select id is not null from public.create_order_product_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"space_id":"79000000-0000-4000-8000-000000000401","product_name":"合法产品"}'::jsonb)), 'draft order can create a product through the RPC');
select ok((select id is not null from public.create_order_item_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"module_id":"79000000-0000-4000-8000-000000000501","product_name":"合法部件"}'::jsonb)), 'draft order can create an item through the RPC');
select is(public.update_order_component_fields('79000000-0000-4000-8000-000000000001','product','79000000-0000-4000-8000-000000000601','{"product_name":"更新产品"}'::jsonb)->>'id', '79000000-0000-4000-8000-000000000601', 'draft product base fields update through the RPC');
select throws_ok($$select public.update_order_component_fields('79000000-0000-4000-8000-000000000001','product','79000000-0000-4000-8000-000000000602','{"product_name":"不可更新"}'::jsonb)$$, 'P0001', 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT', 'producing product base fields cannot change even with a draft parent order');
select throws_ok($$select public.update_order_component_fields('79000000-0000-4000-8000-000000000001','space','79000000-0000-4000-8000-000000000404','{"space_name":"不可更新"}'::jsonb)$$, 'P0001', 'ORDER_COMPONENT_WRITE_STATUS_CONFLICT', 'confirmed space base fields cannot change even with a draft parent order');

reset role;
select set_config('request.jwt.claim.sub', '79000000-0000-4000-8000-000000000012', true);
set local role authenticated;
select throws_ok($$select * from public.create_order_item_with_pricing('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000301','{"module_id":"79000000-0000-4000-8000-000000000501","product_name":"update-only priced item","unit_price":1,"subtotal":1}'::jsonb)$$, '42501', 'ORDER_ITEM_CREATE_FORBIDDEN', 'orders.update without finance.manage cannot create priced items');

select * from finish();
rollback;
