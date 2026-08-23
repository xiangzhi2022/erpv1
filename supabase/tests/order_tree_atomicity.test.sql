begin;

select no_plan();

select has_function(
  'public',
  'save_order_tree',
  array['uuid', 'uuid', 'jsonb'],
  'the complete order tree is saved through one database transaction boundary'
);

select function_privs_are(
  'public',
  'save_order_tree',
  array['uuid', 'uuid', 'jsonb'],
  'authenticated',
  array['EXECUTE'],
  'only authenticated application sessions can invoke the order tree writer'
);

insert into public.enterprises (id, code, name, enterprise_type, status) values
  ('71000000-0000-4000-8000-000000000001', 'atomic-dealer', 'Atomic dealer', 'dealer', 'active'),
  ('71000000-0000-4000-8000-000000000002', 'atomic-factory', 'Atomic factory', 'manufacturer', 'active'),
  ('71000000-0000-4000-8000-000000000003', 'atomic-other', 'Atomic other dealer', 'dealer', 'active');

insert into auth.users (id, email, created_at, updated_at) values
  ('71000000-0000-4000-8000-000000000011', 'atomic-writer@example.invalid', now(), now()),
  ('71000000-0000-4000-8000-000000000012', 'atomic-outsider@example.invalid', now(), now()),
  ('71000000-0000-4000-8000-000000000013', 'atomic-scoped@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('71000000-0000-4000-8000-000000000101', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000011', 'active', 'Atomic writer'),
  ('71000000-0000-4000-8000-000000000102', '71000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000012', 'active', 'Atomic outsider'),
  ('71000000-0000-4000-8000-000000000103', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000013', 'active', 'Atomic scoped writer');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('71000000-0000-4000-8000-000000000201', '71000000-0000-4000-8000-000000000001', 'atomic_order_writer', 'Atomic order writer', false),
  ('71000000-0000-4000-8000-000000000202', '71000000-0000-4000-8000-000000000003', 'atomic_outsider', 'Atomic outsider', false),
  ('71000000-0000-4000-8000-000000000203', '71000000-0000-4000-8000-000000000001', 'atomic_scoped_order', 'Atomic scoped order', false),
  ('71000000-0000-4000-8000-000000000204', '71000000-0000-4000-8000-000000000001', 'atomic_workshop_manager', 'Atomic workshop manager', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', 'orders.create'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', 'orders.update'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', 'finance.manage'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', 'production.plan'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', 'production.manage'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', 'attachments.manage'),
  ('71000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000202', 'orders.create'),
  ('71000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000202', 'orders.update'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000203', 'orders.create'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000203', 'orders.update'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000203', 'production.plan'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000204', 'production.manage'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000204', 'attachments.manage');

insert into public.sites (id, tenant_id, code, name, site_type) values
  ('71000000-0000-4000-8000-000000000401', '71000000-0000-4000-8000-000000000001', 'atomic-site', 'Atomic site', 'factory');
insert into public.workshops (id, tenant_id, site_id, code, name) values
  ('71000000-0000-4000-8000-000000000402', '71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000401', 'atomic-workshop', 'Atomic workshop');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000201', '71000000-0000-4000-8000-000000000101', 'enterprise'),
  ('71000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000202', '71000000-0000-4000-8000-000000000102', 'enterprise'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000203', '71000000-0000-4000-8000-000000000103', 'enterprise'),
  ('71000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000204', '71000000-0000-4000-8000-000000000103', 'workshops');

insert into public.role_binding_workshops (tenant_id, binding_id, workshop_id)
select
  '71000000-0000-4000-8000-000000000001',
  binding.id,
  '71000000-0000-4000-8000-000000000402'
from public.role_bindings binding
where binding.tenant_id = '71000000-0000-4000-8000-000000000001'
  and binding.membership_id = '71000000-0000-4000-8000-000000000103'
  and binding.role_id = '71000000-0000-4000-8000-000000000204'
  and binding.scope_kind = 'workshops';

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select lives_ok(
  $$
    select public.save_order_tree(
      '71000000-0000-4000-8000-000000000001',
      null,
      '{
        "order_no":"ATOMIC-SUCCESS",
        "order_flow":"dealer_to_factory",
        "to_tenant_id":"71000000-0000-4000-8000-000000000002",
        "target_factory_id":"71000000-0000-4000-8000-000000000002",
        "parent_order_id":"",
        "customer_name":"Atomic customer",
        "customer_phone":"",
        "customer_address":"",
        "delivery_date":"",
        "remark":"",
        "modules":[{
          "module_name":"Bedroom",
          "remark":"",
          "items":[{
            "product_name":"Wardrobe",
            "product_type":"custom",
            "specification":"Oak",
            "material":"Oak",
            "woodworking_craft":"",
            "forming_craft":"",
            "painting_craft":"",
            "quantity":1,
            "unit":"piece",
            "unit_price":100,
            "remark":"",
            "attachments":[{
              "file_name":"drawing.pdf",
              "file_path":"orders/drawing.pdf",
              "file_url":"https://files.example/drawing.pdf",
              "file_type":"application/pdf",
              "file_size":100
            }],
            "tasks":[{
              "task_type":"board",
              "task_name":"Cutting",
              "task_code":"",
              "quantity":1,
              "unit":"piece",
              "remark":"",
              "attachments":[]
            }]
          }]
        }]
      }'::jsonb
    )
  $$,
  'a valid order and all of its children commit together'
);

reset role;
select results_eq(
  $$
    select
      (select count(*) from public.orders where order_no = 'ATOMIC-SUCCESS'),
      (select count(*) from public.order_modules where order_id = (select id from public.orders where order_no = 'ATOMIC-SUCCESS')),
      (select count(*) from public.order_items where order_id = (select id from public.orders where order_no = 'ATOMIC-SUCCESS')),
      (select count(*) from public.order_spaces where order_id = (select id from public.orders where order_no = 'ATOMIC-SUCCESS')),
      (select count(*) from public.order_products where order_id = (select id from public.orders where order_no = 'ATOMIC-SUCCESS')),
      (select count(*) from public.production_tasks where order_id = (select id from public.orders where order_no = 'ATOMIC-SUCCESS')),
      (select count(*) from public.order_item_attachments where order_id = (select id from public.orders where order_no = 'ATOMIC-SUCCESS'))
  $$,
  $$values (1::bigint, 1::bigint, 1::bigint, 1::bigint, 1::bigint, 1::bigint, 1::bigint)$$,
  'the committed order contains every expected tree layer'
);

set local role authenticated;
select throws_ok(
  $$
    select public.save_order_tree(
      '71000000-0000-4000-8000-000000000001',
      null,
      '{
        "order_no":"ATOMIC-ROLLBACK",
        "order_flow":"dealer_to_factory",
        "to_tenant_id":"71000000-0000-4000-8000-000000000002",
        "target_factory_id":"71000000-0000-4000-8000-000000000002",
        "customer_name":"Rollback customer",
        "modules":[{
          "module_name":"Bedroom",
          "items":[{
            "product_name":"Wardrobe",
            "quantity":1,
            "unit":"piece",
            "unit_price":100,
            "tasks":[],
            "attachments":[{
              "file_name":"",
              "file_path":"orders/broken.pdf",
              "file_url":"https://files.example/broken.pdf"
            }]
          }]
        }]
      }'::jsonb
    )
  $$,
  '22023',
  'ORDER_ATTACHMENT_INPUT_INVALID',
  'a failure at the final attachment layer aborts the tree transaction'
);

reset role;
select is(
  (select count(*) from public.orders where order_no = 'ATOMIC-ROLLBACK'),
  0::bigint,
  'a failed final child insert leaves no parent or intermediate order rows'
);

set local role authenticated;
select throws_ok(
  $$
    select public.save_order_tree(
      '71000000-0000-4000-8000-000000000003',
      null,
      '{
        "order_no":"ATOMIC-CROSS-TENANT",
        "order_flow":"dealer_to_factory",
        "to_tenant_id":"71000000-0000-4000-8000-000000000002",
        "customer_name":"Cross tenant",
        "modules":[{"module_name":"Room","items":[{"product_name":"Desk","quantity":1,"unit":"piece","unit_price":1,"tasks":[],"attachments":[]}]}]
      }'::jsonb
    )
  $$,
  '42501',
  'ORDER_TREE_CREATE_FORBIDDEN',
  'an actor cannot write another enterprise order tree'
);

reset role;
insert into public.orders (
  id, enterprise_id, order_no, customer_name, status, total_amount, target_factory_id,
  dealer_id, order_flow, from_enterprise_id, to_enterprise_id, created_by
) values (
  '71000000-0000-4000-8000-000000000301',
  '71000000-0000-4000-8000-000000000001',
  'ATOMIC-EMPTY-ORIGINAL',
  'Original customer',
  'returned',
  500,
  '71000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000001',
  'dealer_to_factory',
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000011'
);
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$
    select public.save_order_tree(
      '71000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000301',
      '{
        "order_no":"ATOMIC-EMPTY-CHANGED",
        "order_flow":"dealer_to_factory",
        "to_tenant_id":"71000000-0000-4000-8000-000000000002",
        "target_factory_id":"71000000-0000-4000-8000-000000000002",
        "customer_name":"Changed customer",
        "modules":[{
          "module_name":"Bedroom",
          "items":[{
            "product_name":"Wardrobe",
            "quantity":1,
            "unit":"piece",
            "unit_price":100,
            "tasks":[],
            "attachments":[{"file_name":"","file_path":"broken","file_url":"broken"}]
          }]
        }]
      }'::jsonb
    )
  $$,
  '22023',
  'ORDER_ATTACHMENT_INPUT_INVALID',
  'an empty-tree overwrite also rolls the parent update back when a child fails'
);

reset role;
select results_eq(
  $$select order_no, customer_name, status, total_amount from public.orders where id = '71000000-0000-4000-8000-000000000301'$$,
  $$values ('ATOMIC-EMPTY-ORIGINAL'::text, 'Original customer'::text, 'returned'::text, 500::numeric)$$,
  'a failed overwrite preserves every original parent value'
);

reset role;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000013', true);
set local role authenticated;

select throws_ok(
  $$
    select public.save_order_tree(
      '71000000-0000-4000-8000-000000000001',
      null,
      '{
        "order_no":"ATOMIC-SCOPED-TASK",
        "order_flow":"dealer_to_factory",
        "to_tenant_id":"71000000-0000-4000-8000-000000000002",
        "customer_name":"Scoped task",
        "modules":[{"module_name":"Room","items":[{
          "product_name":"Desk","quantity":1,"unit":"piece","unit_price":1,"attachments":[],
          "tasks":[{"task_type":"board","task_name":"Cutting","quantity":1,"unit":"piece","attachments":[]}]
        }]}]
      }'::jsonb
    )
  $$,
  '42501',
  'ORDER_TREE_TASK_FORBIDDEN',
  'workshop-scoped production.manage cannot authorize unscoped embedded tasks'
);

select throws_ok(
  $$
    select public.save_order_tree(
      '71000000-0000-4000-8000-000000000001',
      null,
      '{
        "order_no":"ATOMIC-SCOPED-ATTACHMENT",
        "order_flow":"dealer_to_factory",
        "to_tenant_id":"71000000-0000-4000-8000-000000000002",
        "customer_name":"Scoped attachment",
        "modules":[{"module_name":"Room","items":[{
          "product_name":"Desk","quantity":1,"unit":"piece","unit_price":1,"tasks":[],
          "attachments":[{"file_name":"drawing.pdf","file_path":"orders/drawing.pdf","file_url":"https://files.example/drawing.pdf"}]
        }]}]
      }'::jsonb
    )
  $$,
  '42501',
  'ORDER_TREE_ATTACHMENT_FORBIDDEN',
  'workshop-scoped attachments.manage cannot authorize order-level attachments'
);

reset role;
select * from finish();
rollback;
