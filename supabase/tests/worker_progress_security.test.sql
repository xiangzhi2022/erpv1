begin;

select plan(12);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'production_tasks' and policyname = 'production_tasks_select') ~ 'can_access_workshop',
  'production task reads require workshop-aware scope'
);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'work_orders' and policyname = 'work_orders_select') ~ 'can_access_workshop',
  'work order reads require workshop-aware scope'
);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'progress_logs' and policyname = 'progress_logs_select') ~ 'can_access_workshop',
  'progress log reads follow their work order workshop scope'
);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'workers' and policyname = 'workers_select') ~ 'can_access_workshop',
  'worker reads require workshop-aware scope'
);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'work_orders' and policyname = 'work_orders_select') ~ 'has_enterprise_permission',
  'unassigned work orders require enterprise-scoped production read'
);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'workers' and policyname = 'workers_select_self') ~ 'auth.uid',
  'a worker can resolve only their own worker binding without production-wide access'
);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'worker_wage_records' and policyname = 'worker_wage_records_select') ~ 'wages.read.self.*auth.uid',
  'self wage reads are tied to auth.uid through a worker binding'
);

select ok(
  to_regprocedure('public.report_worker_task(uuid,uuid,text)') is not null,
  'atomic worker task report RPC exists'
);

select ok(
  to_regprocedure('public.report_work_order_progress(uuid,uuid,text,numeric,text)') is not null,
  'atomic work order progress RPC exists'
);

select is(
  (select pg_get_userbyid(proowner) from pg_proc where oid = 'public.report_worker_task(uuid,uuid,text)'::regprocedure),
  'v2_function_owner',
  'worker report RPC has the dedicated function owner'
);

select ok(
  has_function_privilege('authenticated', 'public.report_worker_task(uuid,uuid,text)', 'EXECUTE'),
  'authenticated callers can execute worker report RPC'
);

select ok(
  has_table_privilege('v2_function_owner', 'public.progress_logs', 'INSERT')
  and has_table_privilege('v2_function_owner', 'public.production_tasks', 'UPDATE')
  and has_table_privilege('v2_function_owner', 'public.work_orders', 'UPDATE'),
  'RPC owner has only the write privileges required for atomic reporting'
);

select * from finish();

rollback;
