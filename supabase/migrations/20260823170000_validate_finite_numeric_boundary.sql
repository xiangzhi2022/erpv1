-- Validate separately from the constraint-creation migration so the brief DDL
-- locks are released before historical rows are scanned. Validation uses the
-- lower-impact PostgreSQL validation lock and deliberately fails on legacy
-- non-finite values, which must be remediated in rehearsal before rollout.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'employees',
    'orders',
    'order_items',
    'order_products',
    'production_tasks',
    'worker_wage_records',
    'wage_rules',
    'work_orders',
    'progress_logs'
  ]
  loop
    execute format(
      'alter table public.%I validate constraint %I',
      target_table,
      target_table || '_finite_numeric_check'
    );
  end loop;
end;
$$;
