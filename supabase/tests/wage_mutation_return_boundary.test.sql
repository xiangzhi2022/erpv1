begin;

select no_plan();

insert into public.enterprises (id, code, name, enterprise_type) values (
  '60000000-0000-4000-8000-000000000001',
  'wage-mutation-boundary',
  'Wage mutation boundary',
  'manufacturer'
);

insert into auth.users (id, email, created_at, updated_at) values (
  '60000000-0000-4000-8000-000000000011',
  'wage-mutation-manager@example.invalid',
  now(),
  now()
);

insert into public.enterprise_memberships (
  id, tenant_id, user_id, status, display_name
) values (
  '60000000-0000-4000-8000-000000000101',
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000011',
  'active',
  'Mutation-only wage manager'
);

insert into public.roles (id, tenant_id, code, name, is_system) values (
  '60000000-0000-4000-8000-000000000201',
  '60000000-0000-4000-8000-000000000001',
  'mutation_only_wage_manager',
  'Mutation-only wage manager',
  false
);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  (
    '60000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000201',
    'wages.manage'
  ),
  (
    '60000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000201',
    'wages.settle'
  );

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values (
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000201',
  '60000000-0000-4000-8000-000000000101',
  'enterprise'
);

insert into public.workers (
  id, enterprise_id, worker_no, name, status
) values (
  '60000000-0000-4000-8000-000000000301',
  '60000000-0000-4000-8000-000000000001',
  'WAGE-WORKER-1',
  'Wage worker',
  'active'
);

insert into public.production_tasks (
  id, enterprise_id, product_name, task_name, assigned_worker_id, worker_id
) values (
  '60000000-0000-4000-8000-000000000401',
  '60000000-0000-4000-8000-000000000001',
  'Boundary product',
  'Boundary task',
  '60000000-0000-4000-8000-000000000301',
  '60000000-0000-4000-8000-000000000301'
);

insert into public.worker_wage_records (
  id, enterprise_id, worker_id, task_id, quantity, unit_price, wage_amount, status
) values (
  '60000000-0000-4000-8000-000000000501',
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000301',
  '60000000-0000-4000-8000-000000000401',
  1,
  10,
  10,
  'pending'
);

select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-4000-8000-000000000011',
  true
);
set local role authenticated;

select throws_ok(
  $$
    select * from public.finance_manage_wage_record(
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000501',
      'pending',
      'pending',
      -1,
      1,
      1
    )
  $$,
  '22023',
  'INVALID_WAGE_NUMERIC_VALUE',
  'negative wage inputs are rejected before the update'
);

select ok(
  (
    select not (
      pg_catalog.to_jsonb(mutation) ?| array[
        'wage_amount', 'quantity', 'unit_price', 'worker_id', 'approved_by'
      ]
    )
    from public.finance_manage_wage_record(
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000501',
      'pending',
      'approved',
      20,
      2,
      10
    ) mutation
  ),
  'mutation-only wage manager receives no wage amount fields'
);

select ok(
  (
    select not (
      pg_catalog.to_jsonb(mutation) ?| array[
        'wage_amount', 'quantity', 'unit_price', 'worker_id', 'approved_by'
      ]
    )
    from public.finance_settle_wage_records(
      '60000000-0000-4000-8000-000000000001',
      array['60000000-0000-4000-8000-000000000501'::uuid]
    ) mutation
  ),
  'settlement acknowledgement does not disclose wage details'
);

select ok(
  (
    select not (
      pg_catalog.to_jsonb(mutation) ?| array[
        'wage_amount', 'quantity', 'unit_price', 'worker_id', 'approved_by'
      ]
    )
    from public.finance_pay_wage_record(
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000501'
    ) mutation
  ),
  'payment acknowledgement does not disclose wage details'
);

reset role;

select results_eq(
  $$
    select status || ':' || wage_amount::text || ':' || quantity::text || ':' || unit_price::text
    from public.worker_wage_records
    where id = '60000000-0000-4000-8000-000000000501'
  $$,
  $$values ('paid:20.00:2.000:10.00')$$,
  'valid mutation values are persisted before settlement and payment'
);

select * from finish();
rollback;
