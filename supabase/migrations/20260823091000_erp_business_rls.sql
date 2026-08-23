do $$
declare
  table_name text;
  read_permission text;
  write_permission text;
  insert_permission text;
  update_permission text;
  delete_permission text;
begin
  foreach table_name in array array[
    'profiles','customers','departments','positions','employees','employee_positions','employee_roles',
    'order_prefixes','orders','order_spaces','order_products','order_modules','order_items',
    'order_item_attachments','order_exchanges','factory_workshops','production_tasks','wage_rules',
    'worker_wage_records','order_status_logs','work_orders','progress_logs','workers','suppliers','dealers',
    'categories','tasks','notifications','user_settings','enterprise_join_requests'
  ] loop
    read_permission := case
      when table_name in ('customers') then 'customers.read'
      when table_name in ('orders','order_spaces','order_products','order_modules','order_items','order_exchanges','order_status_logs') then 'orders.read'
      when table_name = 'order_item_attachments' then 'attachments.read'
      when table_name in ('production_tasks','work_orders','progress_logs','factory_workshops','workers') then 'production.read'
      when table_name in ('wage_rules','worker_wage_records') then 'wages.read.all'
      when table_name in ('suppliers','dealers') then 'partners.read'
      when table_name in ('categories','order_prefixes') then 'catalog.read'
      when table_name = 'tasks' then 'tasks.read'
      when table_name = 'notifications' then 'notifications.read'
      when table_name = 'user_settings' then 'settings.read'
      else 'members.read'
    end;
    write_permission := case
      when table_name = 'customers' then 'customers.manage'
      when table_name = 'orders' then 'orders.manage'
      when table_name in ('order_spaces','order_products','order_modules','order_items','order_exchanges','order_status_logs') then 'orders.update'
      when table_name = 'order_item_attachments' then 'attachments.manage'
      when table_name in ('production_tasks','work_orders','progress_logs','factory_workshops','workers') then 'production.manage'
      when table_name in ('wage_rules','worker_wage_records') then 'wages.manage'
      when table_name in ('suppliers','dealers') then 'partners.manage'
      when table_name in ('categories','order_prefixes') then 'catalog.manage'
      when table_name = 'tasks' then 'tasks.manage'
      when table_name = 'notifications' then 'notifications.manage'
      when table_name = 'user_settings' then 'settings.manage'
      else 'members.manage'
    end;
    insert_permission := write_permission;
    update_permission := write_permission;
    delete_permission := write_permission;

    if table_name = 'orders' then
      insert_permission := 'orders.create';
      update_permission := 'orders.update';
      delete_permission := 'orders.manage';
    elsif table_name in ('production_tasks', 'work_orders') then
      insert_permission := 'production.plan';
      update_permission := 'production.manage';
      delete_permission := 'production.manage';
    elsif table_name = 'progress_logs' then
      insert_permission := 'production.report.self';
      update_permission := 'production.review';
      delete_permission := 'production.manage';
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (app_private.has_permission(enterprise_id, %L))', table_name || '_select', table_name, read_permission);
    execute format('create policy %I on public.%I for insert to authenticated with check (app_private.has_permission(enterprise_id, %L))', table_name || '_insert', table_name, insert_permission);
    execute format('create policy %I on public.%I for update to authenticated using (app_private.has_permission(enterprise_id, %L)) with check (app_private.has_permission(enterprise_id, %L))', table_name || '_update', table_name, update_permission, update_permission);
    execute format('create policy %I on public.%I for delete to authenticated using (app_private.has_permission(enterprise_id, %L))', table_name || '_delete', table_name, delete_permission);
  end loop;
end;
$$;

drop policy profiles_select on public.profiles;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or app_private.has_permission(enterprise_id, 'members.read')
);
