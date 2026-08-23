begin;
select plan(2);

with expected(path) as (
  values
    ('employees.base_salary'),
    ('orders.total_amount'),
    ('order_items.quantity'),
    ('order_items.unit_price'),
    ('order_products.quoted_amount'),
    ('production_tasks.estimated_wage_amount')
)
select is(
  (
    select count(*)
    from expected
    join pg_catalog.pg_constraint constraint_row
      on constraint_row.conrelid = pg_catalog.to_regclass(
        'public.' || pg_catalog.split_part(expected.path, '.', 1)
      )
     and constraint_row.conname = pg_catalog.split_part(expected.path, '.', 1)
       || '_finite_numeric_check'
     and constraint_row.contype = 'c'
     and constraint_row.convalidated
     and pg_catalog.pg_get_constraintdef(constraint_row.oid) like '%'
       || pg_catalog.split_part(expected.path, '.', 2) || '%'
  ),
  6::bigint,
  'representative JSON mutation numerics have validated finite constraints'
);

select is(
  (
    select count(*)
    from information_schema.columns as column_info
    left join pg_catalog.pg_constraint constraint_row
      on constraint_row.conrelid = pg_catalog.to_regclass(
        'public.' || column_info.table_name
      )
     and constraint_row.conname = column_info.table_name || '_finite_numeric_check'
     and constraint_row.contype = 'c'
     and constraint_row.convalidated
     and pg_catalog.pg_get_constraintdef(constraint_row.oid) like '%'
       || column_info.column_name || '%'
    where column_info.table_schema = 'public'
      and column_info.data_type = 'numeric'
      and column_info.table_name in (
        'employees', 'orders', 'order_items', 'order_products',
        'production_tasks', 'worker_wage_records', 'wage_rules',
        'work_orders', 'progress_logs'
      )
      and constraint_row.oid is null
  ),
  0::bigint,
  'non-finite values are rejected at the storage boundary'
);

select * from finish();
rollback;
