-- These rows carry enterprise-wide customer, order, or employee data but have no
-- site/workshop key that can safely constrain a scoped role. A scoped grant must
-- therefore not be treated as an enterprise-wide read grant.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
for select to authenticated
using (
  app_private.has_enterprise_permission(orders.enterprise_id, 'orders.read')
);

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
for select to authenticated
using (
  app_private.has_enterprise_permission(order_items.enterprise_id, 'orders.read')
);

drop policy if exists order_products_select on public.order_products;
create policy order_products_select on public.order_products
for select to authenticated
using (
  app_private.has_enterprise_permission(order_products.enterprise_id, 'orders.read')
);

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
for select to authenticated
using (
  app_private.has_enterprise_permission(employees.enterprise_id, 'members.read')
);

drop policy if exists customers_select on public.customers;
drop policy if exists customers_insert on public.customers;
drop policy if exists customers_update on public.customers;
drop policy if exists customers_delete on public.customers;
create policy customers_select on public.customers
for select to authenticated
using (
  app_private.has_enterprise_permission(customers.enterprise_id, 'customers.read')
);
create policy customers_insert on public.customers
for insert to authenticated
with check (
  app_private.has_enterprise_permission(customers.enterprise_id, 'customers.manage')
);
create policy customers_update on public.customers
for update to authenticated
using (
  app_private.has_enterprise_permission(customers.enterprise_id, 'customers.manage')
)
with check (
  app_private.has_enterprise_permission(customers.enterprise_id, 'customers.manage')
);
create policy customers_delete on public.customers
for delete to authenticated
using (
  app_private.has_enterprise_permission(customers.enterprise_id, 'customers.manage')
);

drop policy if exists order_exchanges_participant_select on public.order_exchanges;
create policy order_exchanges_participant_select on public.order_exchanges
for select to authenticated
using (
  app_private.has_enterprise_permission(order_exchanges.from_enterprise_id, 'orders.read')
  or app_private.has_enterprise_permission(order_exchanges.to_enterprise_id, 'orders.read')
);

-- Scope-less order/member/partner tables cannot safely interpret a site or
-- workshop grant. Replace their inherited generic policies with enterprise-only
-- guards. Tables with a real workshop/self mapping keep their specialized policy.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select * from (values
      ('order_spaces', 'orders.read'),
      ('order_modules', 'orders.read'),
      ('order_item_attachments', 'attachments.read'),
      ('order_status_logs', 'orders.read'),
      ('departments', 'members.read'),
      ('positions', 'members.read'),
      ('employee_positions', 'members.read'),
      ('employee_roles', 'members.read'),
      ('suppliers', 'partners.read'),
      ('dealers', 'partners.read'),
      ('wage_rules', 'wages.read.all'),
      ('order_prefixes', 'catalog.read'),
      ('categories', 'catalog.read'),
      ('tasks', 'tasks.read'),
      ('factory_workshops', 'production.read'),
      ('user_settings', 'settings.read')
    ) as configured(table_name, permission_code)
  loop
    execute format('drop policy if exists %I on public.%I',
      policy_row.table_name || '_select', policy_row.table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app_private.has_enterprise_permission(enterprise_id, %L))',
      policy_row.table_name || '_select', policy_row.table_name, policy_row.permission_code
    );
  end loop;

  for policy_row in
    select * from (values
      ('order_spaces', 'orders.update'),
      ('order_modules', 'orders.update'),
      ('order_items', 'orders.update'),
      ('order_products', 'orders.update'),
      ('order_item_attachments', 'attachments.manage'),
      ('departments', 'members.manage'),
      ('positions', 'members.manage'),
      ('employee_positions', 'members.manage'),
      ('employee_roles', 'members.manage'),
      ('suppliers', 'partners.manage'),
      ('dealers', 'partners.manage'),
      ('wage_rules', 'wages.manage'),
      ('order_prefixes', 'catalog.manage'),
      ('categories', 'catalog.manage'),
      ('tasks', 'tasks.manage'),
      ('factory_workshops', 'production.manage'),
      ('user_settings', 'settings.manage')
    ) as configured(table_name, permission_code)
  loop
    execute format('drop policy if exists %I on public.%I',
      policy_row.table_name || '_insert', policy_row.table_name);
    execute format('drop policy if exists %I on public.%I',
      policy_row.table_name || '_update', policy_row.table_name);
    execute format('drop policy if exists %I on public.%I',
      policy_row.table_name || '_delete', policy_row.table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (app_private.has_enterprise_permission(enterprise_id, %L))',
      policy_row.table_name || '_insert', policy_row.table_name, policy_row.permission_code
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (app_private.has_enterprise_permission(enterprise_id, %L)) with check (app_private.has_enterprise_permission(enterprise_id, %L))',
      policy_row.table_name || '_update', policy_row.table_name,
      policy_row.permission_code, policy_row.permission_code
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (app_private.has_enterprise_permission(enterprise_id, %L))',
      policy_row.table_name || '_delete', policy_row.table_name, policy_row.permission_code
    );
  end loop;
end;
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  profiles.id = (select auth.uid())
  or app_private.has_enterprise_permission(profiles.enterprise_id, 'members.read')
);

drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
revoke insert, update, delete on table public.profiles from authenticated;
grant update (
  display_name,
  phone,
  avatar_url,
  updated_at
) on table public.profiles to authenticated;
create policy profiles_update on public.profiles
for update to authenticated
using (
  profiles.id = (select auth.uid())
  or app_private.has_enterprise_permission(profiles.enterprise_id, 'members.manage')
)
with check (
  profiles.id = (select auth.uid())
  or app_private.has_enterprise_permission(profiles.enterprise_id, 'members.manage')
);

-- production_tasks has a direct workshop_id and keeps the scoped/self-assignment
-- policy installed by 20260823151000_sensitive_read_boundary.sql.
