begin;

select plan(20);

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
  (select qual from pg_policies where schemaname = 'public' and tablename = 'workers' and policyname = 'workers_select') ~ 'members.read.*production.read',
  'worker list reads admit both member and production permissions under their own scopes'
);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'workers' and policyname = 'workers_select') ~ 'wages.manage',
  'wage managers can validate worker-scoped wage rules'
);

select ok(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'positions' and policyname = 'positions_wages_manage_select') ~ 'wages.manage',
  'enterprise wage managers can validate position-scoped wage rules'
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

select ok(
  to_regprocedure('public.create_production_work_order(uuid,uuid,uuid,text,numeric,text,timestamptz,text)') is not null,
  'atomic work order creation RPC exists'
);

select ok(
  (select prosrc from pg_proc where oid = 'public.create_production_work_order(uuid,uuid,uuid,text,numeric,text,timestamptz,text)'::regprocedure) ~ 'target_quantity <> trunc\(target_quantity\)',
  'work order creation RPC enforces the integer quantity contract'
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

select is(
  (select pg_get_userbyid(proowner) from pg_proc where oid = 'public.create_production_work_order(uuid,uuid,uuid,text,numeric,text,timestamptz,text)'::regprocedure),
  'v2_function_owner',
  'work order creation RPC has the dedicated function owner'
);

select ok(
  has_function_privilege('authenticated', 'public.create_production_work_order(uuid,uuid,uuid,text,numeric,text,timestamptz,text)', 'EXECUTE'),
  'authenticated callers can execute work order creation RPC'
);

select ok(
  has_table_privilege('v2_function_owner', 'public.progress_logs', 'INSERT')
  and has_table_privilege('v2_function_owner', 'public.progress_logs', 'SELECT')
  and has_table_privilege('v2_function_owner', 'public.production_tasks', 'UPDATE')
  and has_table_privilege('v2_function_owner', 'public.work_orders', 'UPDATE'),
  'RPC owner can insert and return progress logs during atomic reporting'
);

select ok(
  has_table_privilege('v2_function_owner', 'public.work_orders', 'INSERT')
  and has_table_privilege('v2_function_owner', 'public.progress_logs', 'INSERT')
  and has_table_privilege('v2_function_owner', 'public.orders', 'SELECT'),
  'work order creation RPC owner has its precise table privileges'
);

select * from finish();

rollback;
