begin;
select plan(5);

select has_trigger(
  'public',
  'orders',
  'orders_parent_graph_guard',
  'all order writers are subject to parent graph validation'
);

insert into public.enterprises(id, code, name, enterprise_type) values
  ('91000000-0000-4000-8000-000000000001', 'parent-graph-maker', 'Parent graph maker', 'manufacturer');

insert into public.orders(
  id, enterprise_id, order_no, customer_name, order_flow, to_enterprise_id,
  parent_order_id
) values
  ('91000000-0000-4000-8000-000000000101', '91000000-0000-4000-8000-000000000001', 'GRAPH-PARENT', 'Parent', 'dealer_to_factory', '91000000-0000-4000-8000-000000000001', null),
  ('91000000-0000-4000-8000-000000000102', '91000000-0000-4000-8000-000000000001', 'GRAPH-A', 'A', 'dealer_to_factory', '91000000-0000-4000-8000-000000000001', null),
  ('91000000-0000-4000-8000-000000000103', '91000000-0000-4000-8000-000000000001', 'GRAPH-B', 'B', 'dealer_to_factory', '91000000-0000-4000-8000-000000000001', null),
  ('91000000-0000-4000-8000-000000000104', '91000000-0000-4000-8000-000000000001', 'GRAPH-WRONG-PARENT', 'Wrong parent', 'factory_to_supplier', '91000000-0000-4000-8000-000000000001', null),
  ('91000000-0000-4000-8000-000000000105', '91000000-0000-4000-8000-000000000001', 'GRAPH-SUPPLIER', 'Supplier', 'factory_to_supplier', '91000000-0000-4000-8000-000000000001', null),
  ('91000000-0000-4000-8000-000000000106', '91000000-0000-4000-8000-000000000001', 'GRAPH-VALID-CHILD', 'Valid child', 'factory_to_supplier', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000101');

select throws_ok(
  $$
    update public.orders
    set parent_order_id = id
    where id = '91000000-0000-4000-8000-000000000102'
  $$,
  '23514',
  'ORDER_PARENT_SELF_REFERENCE',
  'an order cannot be its own parent'
);

update public.orders
set parent_order_id = '91000000-0000-4000-8000-000000000103'
where id = '91000000-0000-4000-8000-000000000102';

select throws_ok(
  $$
    update public.orders
    set parent_order_id = '91000000-0000-4000-8000-000000000102'
    where id = '91000000-0000-4000-8000-000000000103'
  $$,
  '23514',
  'ORDER_PARENT_CYCLE',
  'an order parent update cannot create a cycle'
);

select throws_ok(
  $$
    update public.orders
    set parent_order_id = '91000000-0000-4000-8000-000000000104'
    where id = '91000000-0000-4000-8000-000000000105'
  $$,
  '23514',
  'ORDER_PARENT_FLOW_INVALID',
  'supplier-flow orders reject an unrelated parent flow'
);

select throws_ok(
  $$
    update public.orders
    set to_enterprise_id = null
    where id = '91000000-0000-4000-8000-000000000101'
  $$,
  '23514',
  'ORDER_PARENT_CHILD_FLOW_INVALID',
  'a parent cannot be changed out from under a supplier-flow child'
);

select * from finish();
rollback;
