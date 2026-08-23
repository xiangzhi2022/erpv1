begin;

select no_plan();

create temporary table expected_erp_tables (table_name text primary key) on commit drop;

insert into expected_erp_tables (table_name) values
  ('profiles'), ('customers'), ('departments'), ('positions'), ('employees'),
  ('employee_positions'), ('employee_roles'), ('order_prefixes'), ('orders'),
  ('order_spaces'), ('order_products'), ('order_modules'), ('order_items'),
  ('order_item_attachments'), ('order_exchanges'), ('factory_workshops'),
  ('production_tasks'), ('wage_rules'), ('worker_wage_records'),
  ('order_status_logs'), ('work_orders'), ('progress_logs'), ('workers'),
  ('suppliers'), ('dealers'), ('categories'), ('tasks'), ('notifications'),
  ('user_settings'), ('enterprise_join_requests');

select ok(
  to_regclass(format('public.%I', expected.table_name)) is not null,
  format('%s exists', expected.table_name)
)
from expected_erp_tables expected
order by expected.table_name;

select ok(
  column_info.udt_name = 'uuid' and column_info.is_nullable = 'NO',
  format('%s.enterprise_id is a required uuid', expected.table_name)
)
from expected_erp_tables expected
left join information_schema.columns column_info
  on column_info.table_schema = 'public'
 and column_info.table_name = expected.table_name
 and column_info.column_name = 'enterprise_id'
order by expected.table_name;

select ok(
  exists (
    select 1
    from pg_constraint constraint_info
    join pg_class table_info on table_info.oid = constraint_info.conrelid
    join pg_namespace namespace_info on namespace_info.oid = table_info.relnamespace
    join pg_class target_info on target_info.oid = constraint_info.confrelid
    where namespace_info.nspname = 'public'
      and table_info.relname = expected.table_name
      and constraint_info.contype = 'f'
      and target_info.relname = 'enterprises'
      and constraint_info.conkey[1] = (
        select attribute_info.attnum
        from pg_attribute attribute_info
        where attribute_info.attrelid = table_info.oid
          and attribute_info.attname = 'enterprise_id'
      )
  ),
  format('%s.enterprise_id references enterprises', expected.table_name)
)
from expected_erp_tables expected
order by expected.table_name;

select ok(
  coalesce(table_info.relrowsecurity and table_info.relforcerowsecurity, false),
  format('%s enables and forces RLS', expected.table_name)
)
from expected_erp_tables expected
left join pg_class table_info
  on table_info.relname = expected.table_name
left join pg_namespace namespace_info
  on namespace_info.oid = table_info.relnamespace
 and namespace_info.nspname = 'public'
order by expected.table_name;

select ok(
  not has_table_privilege('anon', format('public.%I', expected.table_name), 'INSERT')
  and not has_table_privilege('anon', format('public.%I', expected.table_name), 'UPDATE')
  and not has_table_privilege('anon', format('public.%I', expected.table_name), 'DELETE'),
  format('anon cannot write %s', expected.table_name)
)
from expected_erp_tables expected
where to_regclass(format('public.%I', expected.table_name)) is not null
order by expected.table_name;

select is_empty(
  $$
    select constraint_info.conname
    from pg_constraint constraint_info
    join pg_class table_info on table_info.oid = constraint_info.conrelid
    join pg_namespace namespace_info on namespace_info.oid = table_info.relnamespace
    where namespace_info.nspname = 'public'
      and table_info.relname in (select table_name from expected_erp_tables)
      and constraint_info.contype = 'u'
      and (
        select attribute_info.attname
        from pg_attribute attribute_info
        where attribute_info.attrelid = table_info.oid
          and attribute_info.attnum = constraint_info.conkey[1]
      ) <> 'enterprise_id'
  $$,
  'every ERP unique constraint starts with enterprise_id'
);

select is_empty(
  $$
    select expected.table_name
    from expected_erp_tables expected
    join pg_class table_info on table_info.relname = expected.table_name
    join pg_namespace namespace_info
      on namespace_info.oid = table_info.relnamespace
     and namespace_info.nspname = 'public'
    join pg_attribute attribute_info
      on attribute_info.attrelid = table_info.oid
     and attribute_info.attname = 'enterprise_id'
    where not exists (
      select 1
      from pg_index index_info
      where index_info.indrelid = table_info.oid
        and index_info.indisvalid
        and index_info.indkey[0] = attribute_info.attnum
    )
  $$,
  'every ERP enterprise foreign key has a leading covering index'
);

select ok(
  not has_table_privilege('anon', 'public.api_idempotency_keys', 'SELECT')
  and not has_table_privilege('authenticated', 'public.api_idempotency_keys', 'SELECT'),
  'idempotency storage remains service-only'
);

select ok(
  not has_table_privilege('anon', 'public.identity_action_requests', 'SELECT')
  and not has_table_privilege('authenticated', 'public.identity_action_requests', 'SELECT'),
  'identity action storage remains service-only'
);

select throws_ok(
  $$insert into public.enterprises (code, name, enterprise_type) values ('invalid-new-enterprise', 'Invalid', 'unclassified')$$,
  '23514',
  'New enterprises require a concrete enterprise_type',
  'new onboarding cannot choose the migration-only unclassified type'
);

select matches(
  (select with_check from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_insert'),
  'orders.create',
  'order creation policy uses orders.create'
);

select matches(
  (select qual from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_update'),
  'orders.update',
  'order update policy uses orders.update'
);

insert into public.enterprises (id, code, name, enterprise_type) values
  ('10000000-0000-4000-8000-000000000001', 'rls-a', 'RLS enterprise A', 'manufacturer'),
  ('20000000-0000-4000-8000-000000000002', 'rls-b', 'RLS enterprise B', 'dealer');

insert into auth.users (id, email, created_at, updated_at) values
  ('a0000000-0000-4000-8000-000000000001', 'rls-a@example.invalid', now(), now()),
  ('b0000000-0000-4000-8000-000000000002', 'rls-b@example.invalid', now(), now());

insert into public.enterprise_memberships (id, tenant_id, user_id, status, display_name) values
  ('a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'active', 'User A'),
  ('b1000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'active', 'User B');

insert into public.roles (id, tenant_id, code, name, is_system) values
  ('a2000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'rls_customer_manager', 'RLS customer manager', false),
  ('b2000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'rls_customer_manager', 'RLS customer manager', false);

insert into public.role_permissions (tenant_id, role_id, permission_code) values
  ('10000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'customers.read'),
  ('10000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'customers.manage'),
  ('20000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'customers.read'),
  ('20000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'customers.manage');

insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind) values
  ('10000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'enterprise'),
  ('20000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'enterprise');

insert into public.customers (id, enterprise_id, name) values
  ('a3000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Customer A'),
  ('b3000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Customer B');

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select results_eq(
  $$select count(*)::bigint from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'$$,
  $$values (1::bigint)$$,
  'a user can read the safe blank profile created by the Auth trigger'
);

select results_eq(
  $$select name from public.customers order by name$$,
  $$values ('Customer A'::text)$$,
  'enterprise A cannot select enterprise B customers'
);

select throws_ok(
  $$insert into public.customers (enterprise_id, name) values ('20000000-0000-4000-8000-000000000002', 'Cross tenant insert')$$,
  '42501',
  'new row violates row-level security policy for table "customers"',
  'enterprise A cannot insert enterprise B customers'
);

select is_empty(
  $$update public.customers set name = 'Cross tenant update' where id = 'b3000000-0000-4000-8000-000000000002' returning id$$,
  'enterprise A cannot update enterprise B customers'
);

select is_empty(
  $$delete from public.customers where id = 'b3000000-0000-4000-8000-000000000002' returning id$$,
  'enterprise A cannot delete enterprise B customers'
);

reset role;

select * from finish();

rollback;
