-- PostgreSQL numeric accepts NaN and infinities. Enforce finite persisted ERP
-- values at the table boundary so JSON RPC casts cannot bypass route schemas.

do $$
declare
  numeric_table record;
  constraint_name text;
begin
  for numeric_table in
    select
      column_info.table_name,
      pg_catalog.string_agg(
        pg_catalog.format(
          '%I::text not in (''NaN'', ''Infinity'', ''-Infinity'')',
          column_info.column_name
        ),
        ' and '
        order by column_info.ordinal_position
      ) as finite_expression
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.data_type = 'numeric'
      and column_info.table_name in (
        'employees',
        'orders',
        'order_items',
        'order_products',
        'production_tasks',
        'worker_wage_records',
        'wage_rules',
        'work_orders',
        'progress_logs'
      )
    group by column_info.table_name
    order by column_info.table_name
  loop
    constraint_name := numeric_table.table_name || '_finite_numeric_check';

    execute format(
      'alter table public.%I add constraint %I check (%s) not valid',
      numeric_table.table_name,
      constraint_name,
      numeric_table.finite_expression
    );
  end loop;
end;
$$;
