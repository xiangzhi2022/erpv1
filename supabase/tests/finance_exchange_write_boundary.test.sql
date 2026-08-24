begin;

select no_plan();

select ok(
  not has_column_privilege('authenticated', 'public.orders', 'total_amount', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'cost_amount', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'profit_amount', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.orders', 'deposit_amount', 'UPDATE'),
  'authenticated callers cannot directly update order pricing columns'
);

select ok(
  has_column_privilege('authenticated', 'public.orders', 'customer_name', 'UPDATE')
  and has_column_privilege('authenticated', 'public.orders', 'remark', 'UPDATE'),
  'authenticated callers retain non-financial order update columns'
);

select ok(
  not has_column_privilege('authenticated', 'public.worker_wage_records', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.worker_wage_records', 'approved_by', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.worker_wage_records', 'approved_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.worker_wage_records', 'paid_at', 'UPDATE'),
  'authenticated callers cannot directly update wage workflow columns'
);

select ok(
  not has_table_privilege('authenticated', 'public.worker_wage_records', 'INSERT')
  and not has_table_privilege('authenticated', 'public.worker_wage_records', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.worker_wage_records', 'DELETE')
  and not has_column_privilege('authenticated', 'public.worker_wage_records', 'wage_amount', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.worker_wage_records', 'quantity', 'UPDATE'),
  'authenticated callers cannot write wage records outside guarded RPCs'
);

select is_empty(
  $$
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'order_exchanges'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  $$,
  'order exchanges expose no direct authenticated write policies'
);

select ok(
  not has_table_privilege('authenticated', 'public.order_exchanges', 'INSERT')
  and not has_table_privilege('authenticated', 'public.order_exchanges', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.order_exchanges', 'DELETE'),
  'order exchange table writes are RPC-only'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_order_exchange(uuid,uuid,uuid,text,jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.transition_order_exchange(uuid,text,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated callers can execute the restricted exchange RPCs'
);

select results_eq(
  $$
    select array_agg(status order by status)
    from (
      values
        ('draft'::text),
        ('sent'),
        ('change_requested'),
        ('accepted'),
        ('completed'),
        ('returned'),
        ('rejected'),
        ('withdrawn')
    ) supported(status)
    where status = any (
      regexp_split_to_array(
        regexp_replace(
          pg_get_constraintdef(
            (
              select oid
              from pg_constraint
              where conrelid = 'public.order_exchanges'::regclass
                and conname = 'order_exchanges_status_check'
            )
          ),
          '[^a-z_]+' ,
          ' ',
          'g'
        ),
        '\s+'
      )
    )
  $$,
  $$
    values (array[
      'accepted', 'change_requested', 'completed', 'draft',
      'rejected', 'returned', 'sent', 'withdrawn'
    ]::text[])
  $$,
  'order exchange constraint accepts the full application and legacy status vocabulary'
);

insert into public.enterprises (id, code, name, enterprise_type) values
  ('41000000-0000-4000-8000-000000000001', 'write-boundary-a', 'Write boundary A', 'dealer'),
  ('42000000-0000-4000-8000-000000000002', 'write-boundary-b', 'Write boundary B', 'manufacturer');

insert into auth.users (id, email, created_at, updated_at) values
  ('41000000-0000-4000-8000-000000000011', 'write-a@example.invalid', now(), now()),
  ('42000000-0000-4000-8000-000000000012', 'write-b@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000011', 'active', 'Write A'),
  ('42000000-0000-4000-8000-000000000102', '42000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000012', 'active', 'Write B');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('41000000-0000-4000-8000-000000000201', '41000000-0000-4000-8000-000000000001', 'write_sender', 'Write sender', false),
  ('42000000-0000-4000-8000-000000000202', '42000000-0000-4000-8000-000000000002', 'write_receiver', 'Write receiver', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000201', 'orders.read'),
  ('41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000201', 'orders.update'),
  ('41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000201', 'orders.submit'),
  ('42000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000202', 'orders.read'),
  ('42000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000202', 'orders.accept');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000201', '41000000-0000-4000-8000-000000000101', 'enterprise'),
  ('42000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000202', '42000000-0000-4000-8000-000000000102', 'enterprise');

insert into public.orders (
  id, enterprise_id, order_no, customer_name, total_amount, order_flow,
  from_enterprise_id, to_enterprise_id, target_factory_id
) values (
  '41000000-0000-4000-8000-000000000301',
  '41000000-0000-4000-8000-000000000001',
  'WRITE-BOUNDARY-1',
  'Original customer',
  100,
  'dealer_to_factory',
  '41000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000002'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000011', true);
set local role authenticated;

select throws_ok(
  $$update public.orders set total_amount = 999 where id = '41000000-0000-4000-8000-000000000301'$$,
  '42501',
  'permission denied for table orders',
  'orders.update cannot write pricing columns directly'
);

select lives_ok(
  $$update public.orders set customer_name = 'Allowed customer update' where id = '41000000-0000-4000-8000-000000000301'$$,
  'orders.update retains non-financial updates'
);

select throws_ok(
  $$update public.worker_wage_records set wage_amount = 999 where false$$,
  '42501',
  'permission denied for table worker_wage_records',
  'browser roles cannot write wage amounts directly'
);

select throws_ok(
  $$insert into public.worker_wage_records (
    enterprise_id, worker_id, quantity, unit_price, wage_amount
  ) values (
    '41000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000201',
    1, 1, 1
  )$$,
  '42501',
  'permission denied for table worker_wage_records',
  'browser roles cannot insert wage records directly'
);

select throws_ok(
  $$
    insert into public.order_exchanges (
      enterprise_id, order_id, from_enterprise_id, to_enterprise_id, from_user_id
    ) values (
      '41000000-0000-4000-8000-000000000001',
      '41000000-0000-4000-8000-000000000301',
      '41000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000002',
      '41000000-0000-4000-8000-000000000011'
    )
  $$,
  '42501',
  'permission denied for table order_exchanges',
  'senders cannot bypass exchange creation RPC'
);

select results_eq(
  $$
    select status
    from public.create_order_exchange(
      '41000000-0000-4000-8000-000000000001',
      '41000000-0000-4000-8000-000000000301',
      '42000000-0000-4000-8000-000000000002',
      'Initial handoff',
      null
    )
  $$,
  $$values ('sent'::text)$$,
  'authorized senders create exchanges through the RPC'
);

reset role;
select set_config('request.jwt.claim.sub', '42000000-0000-4000-8000-000000000012', true);
set local role authenticated;

select throws_ok(
  $$
    update public.order_exchanges
    set status = 'accepted'
    where order_id = '41000000-0000-4000-8000-000000000301'
  $$,
  '42501',
  'permission denied for table order_exchanges',
  'receivers cannot bypass exchange transition RPC'
);

select results_eq(
  $$
    select status
    from public.transition_order_exchange(
      (
        select id
        from public.order_exchanges
        where order_id = '41000000-0000-4000-8000-000000000301'
      ),
      'request_change',
      'Please revise',
      '{"delivery_date":"2026-09-01"}'::jsonb
    )
  $$,
  $$values ('change_requested'::text)$$,
  'authorized receivers use the atomic exchange transition state machine'
);

select throws_ok(
  $$
    select *
    from public.transition_order_exchange(
      (
        select id
        from public.order_exchanges
        where order_id = '41000000-0000-4000-8000-000000000301'
      ),
      'request_change',
      null,
      null
    )
  $$,
  'P0001',
  'ORDER_EXCHANGE_STATUS_CONFLICT',
  'the exchange state machine rejects invalid repeated transitions'
);

reset role;

select * from finish();

rollback;
