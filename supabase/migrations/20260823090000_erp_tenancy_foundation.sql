alter table public.enterprises
  add column enterprise_type text;

update public.enterprises
set enterprise_type = 'unclassified'
where enterprise_type is null;

alter table public.enterprises
  alter column enterprise_type set not null,
  add constraint enterprises_enterprise_type_check
    check (enterprise_type in ('platform', 'manufacturer', 'dealer', 'supplier', 'unclassified'));

insert into public.enterprises (code, name, enterprise_type)
values ('platform-profiles', 'Platform profile holding enterprise', 'platform')
on conflict (code) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  enterprise_id uuid not null references public.enterprises(id),
  display_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enterprise_id, id)
);

create function public.create_blank_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.profiles (id, enterprise_id)
  select new.id, enterprise.id
  from public.enterprises enterprise
  where enterprise.code = 'platform-profiles';
  return new;
end;
$$;

revoke all on function public.create_blank_profile() from public, anon, authenticated;

create trigger auth_user_create_blank_profile
after insert on auth.users
for each row execute function public.create_blank_profile();

create table public.customers (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  name text not null, phone text, address text, source text, status text not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), check (status in ('active', 'inactive'))
);

create table public.departments (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  name text not null, code text not null, parent_id uuid, sort_order integer not null default 0,
  status text not null default 'active', remark text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (enterprise_id, id), unique (enterprise_id, code),
  foreign key (enterprise_id, parent_id) references public.departments(enterprise_id, id),
  check (status in ('active', 'inactive'))
);

create table public.positions (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  name text not null, code text not null, department_id uuid, position_type text not null default 'general',
  can_receive_production_task boolean not null default false, can_calculate_piece_wage boolean not null default false,
  can_review_task boolean not null default false, can_assign_task boolean not null default false,
  default_role_code text, status text not null default 'active', remark text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, code),
  foreign key (enterprise_id, department_id) references public.departments(enterprise_id, id),
  check (status in ('active', 'inactive'))
);

create table public.employees (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  user_id uuid references auth.users(id), employee_no text not null, name text not null, phone text, email text,
  avatar_url text, department_id uuid, primary_position_id uuid, employee_type text not null default 'full_time',
  status text not null default 'active', hire_date date, leave_date date, base_salary numeric(18,2) not null default 0,
  remark text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, employee_no), unique (enterprise_id, user_id),
  foreign key (enterprise_id, department_id) references public.departments(enterprise_id, id),
  foreign key (enterprise_id, primary_position_id) references public.positions(enterprise_id, id),
  check (status in ('active', 'inactive', 'departed'))
);

create table public.employee_positions (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  employee_id uuid not null, position_id uuid not null, is_primary boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, employee_id, position_id),
  foreign key (enterprise_id, employee_id) references public.employees(enterprise_id, id) on delete cascade,
  foreign key (enterprise_id, position_id) references public.positions(enterprise_id, id) on delete cascade
);

create table public.employee_roles (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  employee_id uuid not null, role_id uuid not null, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (enterprise_id, id),
  unique (enterprise_id, employee_id, role_id),
  foreign key (enterprise_id, employee_id) references public.employees(enterprise_id, id) on delete cascade,
  foreign key (enterprise_id, role_id) references public.roles(tenant_id, id) on delete cascade
);

create table public.order_prefixes (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  prefix text not null, name text not null, company_name text, phone text, address text,
  current_val integer not null default 0, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (enterprise_id, id), unique (enterprise_id, prefix)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  order_no text not null, customer_name text not null, customer_phone text, customer_address text,
  order_source text, status text not null default 'pending', total_amount numeric(18,2) not null default 0,
  cost_amount numeric(18,2) not null default 0, profit_amount numeric(18,2) not null default 0,
  deposit_amount numeric(18,2) not null default 0, target_factory_id uuid references public.enterprises(id),
  dealer_id uuid references public.enterprises(id), order_flow text not null default 'legacy',
  from_enterprise_id uuid references public.enterprises(id), to_enterprise_id uuid references public.enterprises(id),
  parent_order_id uuid, delivery_date date, remark text, internal_remark text, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, order_no),
  foreign key (enterprise_id, parent_order_id) references public.orders(enterprise_id, id),
  check (status in ('pending', 'draft', 'submitted', 'accepted', 'producing', 'completed', 'cancelled', 'rejected'))
);

create table public.order_spaces (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  order_id uuid not null, space_no text not null, space_name text not null, space_type text,
  sort_order integer not null default 1, status text not null default 'draft', remark text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, order_id, space_no),
  foreign key (enterprise_id, order_id) references public.orders(enterprise_id, id) on delete cascade
);

create table public.order_products (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  order_id uuid not null, space_id uuid not null, product_no text not null, product_name text not null,
  product_type text not null default 'custom', product_model text, width numeric(12,2), height numeric(12,2),
  depth numeric(12,2), area numeric(18,4), quantity numeric(18,3) not null default 1, material text,
  color text, status text not null default 'draft', quoted_amount numeric(18,2) not null default 0,
  cost_amount numeric(18,2) not null default 0, profit_amount numeric(18,2) not null default 0,
  sort_order integer not null default 1, remark text, internal_remark text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, order_id, product_no),
  foreign key (enterprise_id, order_id) references public.orders(enterprise_id, id) on delete cascade,
  foreign key (enterprise_id, space_id) references public.order_spaces(enterprise_id, id) on delete cascade
);

create table public.order_modules (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  order_id uuid not null, module_no text not null, module_name text not null, sort_order integer not null default 1,
  remark text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, order_id, module_no),
  foreign key (enterprise_id, order_id) references public.orders(enterprise_id, id) on delete cascade
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  order_id uuid not null, module_id uuid, item_no text, product_name text not null, specifications text,
  woodworking_craft text, forming_craft text, painting_craft text, length_mm numeric(12,2),
  width_mm numeric(12,2), thickness_mm numeric(12,2), quantity numeric(18,3) not null default 1,
  unit text not null default '件', color text, hardware text, hardware_quantity numeric(18,3),
  construction_surface text, unit_price numeric(18,2) not null default 0, subtotal numeric(18,2) not null default 0,
  remark text, sort_order integer not null default 1, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (enterprise_id, id),
  foreign key (enterprise_id, order_id) references public.orders(enterprise_id, id) on delete cascade,
  foreign key (enterprise_id, module_id) references public.order_modules(enterprise_id, id) on delete cascade
);

create table public.order_item_attachments (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  order_id uuid not null, module_id uuid, order_item_id uuid not null, file_name text not null,
  file_path text not null, file_url text not null, file_type text, file_size bigint, uploaded_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (enterprise_id, id),
  foreign key (enterprise_id, order_id) references public.orders(enterprise_id, id) on delete cascade,
  foreign key (enterprise_id, module_id) references public.order_modules(enterprise_id, id) on delete cascade,
  foreign key (enterprise_id, order_item_id) references public.order_items(enterprise_id, id) on delete cascade
);

create table public.order_exchanges (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  order_id uuid not null, from_enterprise_id uuid not null references public.enterprises(id),
  to_enterprise_id uuid not null references public.enterprises(id), from_user_id uuid not null,
  status text not null default 'sent', message text, proposed_changes jsonb, handled_by uuid,
  handled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), foreign key (enterprise_id, order_id) references public.orders(enterprise_id, id) on delete cascade,
  check (status in ('sent', 'accepted', 'returned', 'rejected', 'withdrawn'))
);

create table public.factory_workshops (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  name text not null, factory_code text, manager text, location text, capacity integer not null default 0,
  current_load integer not null default 0, status text not null default 'normal', description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (enterprise_id, id)
);

create table public.workers (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  user_id uuid references auth.users(id), worker_no text not null, name text not null, phone text, gender text,
  craft_type text, workshop_id uuid, can_receive_production_task boolean not null default true,
  can_calculate_piece_wage boolean not null default true, status text not null default 'active', skill_tags jsonb,
  hire_date date, remark text, created_by uuid, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (enterprise_id, id), unique (enterprise_id, worker_no),
  foreign key (enterprise_id, workshop_id) references public.workshops(tenant_id, id),
  check (status in ('active', 'inactive', 'departed'))
);

create table public.wage_rules (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  rule_name text not null, task_type text not null, process_name text, unit text not null default '件',
  unit_price numeric(18,2) not null default 0, calculation_method text not null default 'by_piece',
  role_scope text, scope_type text not null default 'company', worker_id uuid, position_id uuid,
  product_type text, extra_amount numeric(18,2) not null default 0, enabled boolean not null default true,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), foreign key (enterprise_id, worker_id) references public.workers(enterprise_id, id),
  foreign key (enterprise_id, position_id) references public.positions(enterprise_id, id)
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  order_id uuid, factory_id uuid references public.enterprises(id), workshop_id uuid, product_name text not null,
  target_quantity numeric(18,3) not null, completed_quantity numeric(18,3) not null default 0,
  status text not null default 'pending', priority text not null default 'normal', start_date timestamptz,
  expected_end_date timestamptz, actual_end_date timestamptz, remark text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (enterprise_id, id),
  foreign key (enterprise_id, order_id) references public.orders(enterprise_id, id),
  foreign key (enterprise_id, workshop_id) references public.workshops(tenant_id, id),
  check (status in ('pending', 'producing', 'inspecting', 'stored', 'aborted')),
  check (priority in ('low', 'normal', 'high', 'urgent')),
  check (completed_quantity >= 0 and completed_quantity <= target_quantity)
);

create table public.production_tasks (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  work_order_id uuid, order_id uuid, space_id uuid, product_id uuid, task_no text, task_type text not null default 'process',
  task_name text, task_code text, product_name text not null, quantity numeric(18,3) not null default 1,
  unit text not null default '件', length numeric(12,2), width numeric(12,2), thickness numeric(12,2), area numeric(18,4),
  material text, color text, process_name text, completed numeric(18,3) not null default 0,
  status text not null default 'pending', priority integer not null default 0, progress text not null default 'pending',
  worker_id uuid, assigned_to uuid, assigned_worker_id uuid, workshop_id uuid, workstation_id uuid,
  wage_rule_id uuid, estimated_wage_amount numeric(18,2) not null default 0, final_wage_amount numeric(18,2) not null default 0,
  planned_start_date date, planned_end_date date, actual_start_date date, actual_end_date date,
  started_at timestamptz, submitted_at timestamptz, completed_at timestamptz, approved_at timestamptz,
  approved_by uuid, start_date timestamptz, end_date timestamptz, remark text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (enterprise_id, id),
  foreign key (enterprise_id, work_order_id) references public.work_orders(enterprise_id, id),
  foreign key (enterprise_id, order_id) references public.orders(enterprise_id, id),
  foreign key (enterprise_id, space_id) references public.order_spaces(enterprise_id, id),
  foreign key (enterprise_id, product_id) references public.order_products(enterprise_id, id),
  foreign key (enterprise_id, worker_id) references public.workers(enterprise_id, id),
  foreign key (enterprise_id, assigned_worker_id) references public.workers(enterprise_id, id),
  foreign key (enterprise_id, workshop_id) references public.workshops(tenant_id, id),
  foreign key (enterprise_id, workstation_id) references public.workstations(tenant_id, id),
  foreign key (enterprise_id, wage_rule_id) references public.wage_rules(enterprise_id, id)
);

create table public.worker_wage_records (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  worker_id uuid not null, order_id uuid, space_id uuid, product_id uuid, task_id uuid not null, wage_rule_id uuid,
  quantity numeric(18,3) not null default 1, unit_price numeric(18,2) not null default 0,
  wage_amount numeric(18,2) not null default 0, status text not null default 'pending', submitted_at timestamptz,
  approved_by uuid, approved_at timestamptz, paid_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (enterprise_id, id),
  foreign key (enterprise_id, worker_id) references public.workers(enterprise_id, id),
  foreign key (enterprise_id, task_id) references public.production_tasks(enterprise_id, id),
  foreign key (enterprise_id, wage_rule_id) references public.wage_rules(enterprise_id, id),
  check (status in ('pending', 'approved', 'settled', 'paid', 'rejected'))
);

create table public.order_status_logs (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  target_type text not null, target_id uuid not null, from_status text, to_status text not null,
  changed_by uuid, changed_at timestamptz not null default now(), remark text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (enterprise_id, id)
);

create table public.progress_logs (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  work_order_id uuid not null, operator_id uuid, operator_name text, action text not null,
  completed_delta numeric(18,3) not null default 0, remark text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (enterprise_id, id),
  foreign key (enterprise_id, work_order_id) references public.work_orders(enterprise_id, id) on delete cascade
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  supplier_code text not null, name text not null, contact_person text, phone text, email text, category text,
  rating text not null default 'B', status text not null default 'active', address text, remark text, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, supplier_code)
);

create table public.dealers (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  name text not null, contact_name text, phone text, region text, status text not null default 'active',
  remark text, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  name text not null, color text not null default '#6366f1', description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, name)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  title text not null, description text, status text not null default 'pending', priority integer not null default 0,
  category_id uuid, assignee_id uuid, assignee_name text, assignee_avatar text, due_date timestamptz,
  completed boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (enterprise_id, id),
  foreign key (enterprise_id, category_id) references public.categories(enterprise_id, id) on delete cascade,
  check (status in ('pending', 'in_progress', 'completed', 'cancelled'))
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  task_id uuid, recipient_id uuid, type text not null default 'assignment', title text not null, message text,
  read boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (enterprise_id, id),
  foreign key (enterprise_id, task_id) references public.tasks(enterprise_id, id) on delete cascade
);

create table public.user_settings (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  user_id uuid not null references auth.users(id) on delete cascade, key text not null, value jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, user_id, key)
);

create table public.enterprise_join_requests (
  id uuid primary key default gen_random_uuid(), enterprise_id uuid not null references public.enterprises(id),
  user_id uuid not null references auth.users(id) on delete cascade, status text not null default 'pending',
  requested_role_code text, message text, handled_by uuid, handled_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (enterprise_id, id), unique (enterprise_id, user_id),
  check (status in ('pending', 'approved', 'rejected', 'cancelled'))
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','customers','departments','positions','employees','employee_positions','employee_roles',
    'order_prefixes','orders','order_spaces','order_products','order_modules','order_items',
    'order_item_attachments','order_exchanges','factory_workshops','production_tasks','wage_rules',
    'worker_wage_records','order_status_logs','work_orders','progress_logs','workers','suppliers','dealers',
    'categories','tasks','notifications','user_settings','enterprise_join_requests'
  ] loop
    execute format('create index %I on public.%I (enterprise_id)', table_name || '_enterprise_id_idx', table_name);
  end loop;
end;
$$;

create function public.reject_unclassified_enterprise_onboarding()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.enterprise_type = 'unclassified' then
    raise exception 'New enterprises require a concrete enterprise_type'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_unclassified_enterprise_onboarding()
  from public, anon, authenticated;

create trigger enterprises_require_concrete_type
before insert on public.enterprises
for each row execute function public.reject_unclassified_enterprise_onboarding();

insert into public.permission_catalog (code, description) values
  ('organization.read','Read organization'),('organization.manage','Manage organization'),
  ('members.read','Read members'),('members.manage','Manage members'),('roles.manage','Manage roles'),('audit.read','Read audit'),
  ('dashboard.read','Read dashboard'),('settings.read','Read settings'),('settings.manage','Manage settings'),
  ('customers.read','Read customers'),('customers.manage','Manage customers'),('catalog.read','Read catalog'),('catalog.manage','Manage catalog'),
  ('orders.read','Read orders'),('orders.create','Create orders'),('orders.update','Update orders'),('orders.submit','Submit orders'),
  ('orders.accept','Accept orders'),('orders.manage','Manage orders'),('partners.read','Read partners'),('partners.manage','Manage partners'),
  ('production.read','Read production'),('production.plan','Plan production'),('production.assign','Assign production'),
  ('production.report.self','Report own production'),('production.review','Review production'),('production.manage','Manage production'),
  ('wages.read.self','Read own wages'),('wages.read.all','Read all wages'),('wages.manage','Manage wages'),('wages.settle','Settle wages'),
  ('finance.read','Read finance'),('finance.manage','Manage finance'),('shipping.read','Read shipping'),('shipping.manage','Manage shipping'),
  ('attachments.read','Read attachments'),('attachments.manage','Manage attachments'),('tasks.read','Read tasks'),('tasks.manage','Manage tasks'),
  ('notifications.read','Read notifications'),('notifications.manage','Manage notifications')
on conflict (code) do update set description = excluded.description;

insert into public.roles (tenant_id, code, name, is_system)
select enterprise.id, role_seed.code, role_seed.name, true
from public.enterprises enterprise
cross join (values
  ('enterprise_owner','Enterprise owner'),('enterprise_admin','Enterprise administrator'),
  ('order_manager','Order manager'),('production_manager','Production manager'),('worker','Worker'),
  ('quality_inspector','Quality inspector'),('finance','Finance'),('warehouse','Warehouse'),
  ('dealer_operator','Dealer operator'),('supplier_operator','Supplier operator')
) role_seed(code, name)
on conflict (tenant_id, code) do update set name = excluded.name, is_system = true;

-- BEGIN STANDARD_ROLE_PERMISSION_MATRIX
with role_permission_seed(role_code, permission_code) as (
  values
  ('enterprise_owner', 'organization.read'),
  ('enterprise_owner', 'organization.manage'),
  ('enterprise_owner', 'members.read'),
  ('enterprise_owner', 'members.manage'),
  ('enterprise_owner', 'roles.manage'),
  ('enterprise_owner', 'audit.read'),
  ('enterprise_owner', 'dashboard.read'),
  ('enterprise_owner', 'settings.read'),
  ('enterprise_owner', 'settings.manage'),
  ('enterprise_owner', 'customers.read'),
  ('enterprise_owner', 'customers.manage'),
  ('enterprise_owner', 'catalog.read'),
  ('enterprise_owner', 'catalog.manage'),
  ('enterprise_owner', 'orders.read'),
  ('enterprise_owner', 'orders.create'),
  ('enterprise_owner', 'orders.update'),
  ('enterprise_owner', 'orders.submit'),
  ('enterprise_owner', 'orders.accept'),
  ('enterprise_owner', 'orders.manage'),
  ('enterprise_owner', 'partners.read'),
  ('enterprise_owner', 'partners.manage'),
  ('enterprise_owner', 'production.read'),
  ('enterprise_owner', 'production.plan'),
  ('enterprise_owner', 'production.assign'),
  ('enterprise_owner', 'production.report.self'),
  ('enterprise_owner', 'production.review'),
  ('enterprise_owner', 'production.manage'),
  ('enterprise_owner', 'wages.read.self'),
  ('enterprise_owner', 'wages.read.all'),
  ('enterprise_owner', 'wages.manage'),
  ('enterprise_owner', 'wages.settle'),
  ('enterprise_owner', 'finance.read'),
  ('enterprise_owner', 'finance.manage'),
  ('enterprise_owner', 'shipping.read'),
  ('enterprise_owner', 'shipping.manage'),
  ('enterprise_owner', 'attachments.read'),
  ('enterprise_owner', 'attachments.manage'),
  ('enterprise_owner', 'tasks.read'),
  ('enterprise_owner', 'tasks.manage'),
  ('enterprise_owner', 'notifications.read'),
  ('enterprise_owner', 'notifications.manage'),
  ('enterprise_admin', 'organization.read'),
  ('enterprise_admin', 'organization.manage'),
  ('enterprise_admin', 'members.read'),
  ('enterprise_admin', 'members.manage'),
  ('enterprise_admin', 'roles.manage'),
  ('enterprise_admin', 'dashboard.read'),
  ('enterprise_admin', 'settings.read'),
  ('enterprise_admin', 'settings.manage'),
  ('enterprise_admin', 'customers.read'),
  ('enterprise_admin', 'customers.manage'),
  ('enterprise_admin', 'catalog.read'),
  ('enterprise_admin', 'catalog.manage'),
  ('enterprise_admin', 'orders.read'),
  ('enterprise_admin', 'orders.create'),
  ('enterprise_admin', 'orders.update'),
  ('enterprise_admin', 'orders.submit'),
  ('enterprise_admin', 'orders.accept'),
  ('enterprise_admin', 'orders.manage'),
  ('enterprise_admin', 'partners.read'),
  ('enterprise_admin', 'partners.manage'),
  ('enterprise_admin', 'production.read'),
  ('enterprise_admin', 'production.plan'),
  ('enterprise_admin', 'production.assign'),
  ('enterprise_admin', 'production.report.self'),
  ('enterprise_admin', 'production.review'),
  ('enterprise_admin', 'production.manage'),
  ('enterprise_admin', 'wages.read.self'),
  ('enterprise_admin', 'wages.read.all'),
  ('enterprise_admin', 'wages.manage'),
  ('enterprise_admin', 'finance.read'),
  ('enterprise_admin', 'finance.manage'),
  ('enterprise_admin', 'shipping.read'),
  ('enterprise_admin', 'shipping.manage'),
  ('enterprise_admin', 'attachments.read'),
  ('enterprise_admin', 'attachments.manage'),
  ('enterprise_admin', 'tasks.read'),
  ('enterprise_admin', 'tasks.manage'),
  ('enterprise_admin', 'notifications.read'),
  ('enterprise_admin', 'notifications.manage'),
  ('order_manager', 'dashboard.read'),
  ('order_manager', 'customers.read'),
  ('order_manager', 'customers.manage'),
  ('order_manager', 'catalog.read'),
  ('order_manager', 'orders.read'),
  ('order_manager', 'orders.create'),
  ('order_manager', 'orders.update'),
  ('order_manager', 'orders.submit'),
  ('order_manager', 'orders.accept'),
  ('order_manager', 'orders.manage'),
  ('order_manager', 'partners.read'),
  ('order_manager', 'production.read'),
  ('order_manager', 'shipping.read'),
  ('order_manager', 'attachments.read'),
  ('order_manager', 'attachments.manage'),
  ('order_manager', 'tasks.read'),
  ('order_manager', 'tasks.manage'),
  ('order_manager', 'notifications.read'),
  ('production_manager', 'dashboard.read'),
  ('production_manager', 'organization.read'),
  ('production_manager', 'members.read'),
  ('production_manager', 'catalog.read'),
  ('production_manager', 'orders.read'),
  ('production_manager', 'production.read'),
  ('production_manager', 'production.plan'),
  ('production_manager', 'production.assign'),
  ('production_manager', 'production.report.self'),
  ('production_manager', 'production.review'),
  ('production_manager', 'production.manage'),
  ('production_manager', 'wages.read.all'),
  ('production_manager', 'wages.manage'),
  ('production_manager', 'shipping.read'),
  ('production_manager', 'attachments.read'),
  ('production_manager', 'attachments.manage'),
  ('production_manager', 'tasks.read'),
  ('production_manager', 'tasks.manage'),
  ('production_manager', 'notifications.read'),
  ('worker', 'production.read'),
  ('worker', 'production.report.self'),
  ('worker', 'wages.read.self'),
  ('worker', 'attachments.read'),
  ('worker', 'tasks.read'),
  ('worker', 'notifications.read'),
  ('quality_inspector', 'production.read'),
  ('quality_inspector', 'production.review'),
  ('quality_inspector', 'attachments.read'),
  ('quality_inspector', 'tasks.read'),
  ('quality_inspector', 'notifications.read'),
  ('finance', 'dashboard.read'),
  ('finance', 'orders.read'),
  ('finance', 'wages.read.all'),
  ('finance', 'wages.manage'),
  ('finance', 'wages.settle'),
  ('finance', 'finance.read'),
  ('finance', 'finance.manage'),
  ('finance', 'shipping.read'),
  ('finance', 'attachments.read'),
  ('finance', 'notifications.read'),
  ('warehouse', 'dashboard.read'),
  ('warehouse', 'orders.read'),
  ('warehouse', 'production.read'),
  ('warehouse', 'shipping.read'),
  ('warehouse', 'shipping.manage'),
  ('warehouse', 'attachments.read'),
  ('warehouse', 'tasks.read'),
  ('warehouse', 'notifications.read'),
  ('dealer_operator', 'dashboard.read'),
  ('dealer_operator', 'customers.read'),
  ('dealer_operator', 'customers.manage'),
  ('dealer_operator', 'catalog.read'),
  ('dealer_operator', 'orders.read'),
  ('dealer_operator', 'orders.create'),
  ('dealer_operator', 'orders.update'),
  ('dealer_operator', 'orders.submit'),
  ('dealer_operator', 'partners.read'),
  ('dealer_operator', 'shipping.read'),
  ('dealer_operator', 'attachments.read'),
  ('dealer_operator', 'attachments.manage'),
  ('dealer_operator', 'tasks.read'),
  ('dealer_operator', 'tasks.manage'),
  ('dealer_operator', 'notifications.read'),
  ('supplier_operator', 'dashboard.read'),
  ('supplier_operator', 'catalog.read'),
  ('supplier_operator', 'catalog.manage'),
  ('supplier_operator', 'orders.read'),
  ('supplier_operator', 'orders.update'),
  ('supplier_operator', 'orders.accept'),
  ('supplier_operator', 'partners.read'),
  ('supplier_operator', 'shipping.read'),
  ('supplier_operator', 'attachments.read'),
  ('supplier_operator', 'attachments.manage'),
  ('supplier_operator', 'tasks.read'),
  ('supplier_operator', 'tasks.manage'),
  ('supplier_operator', 'notifications.read')
)
-- END STANDARD_ROLE_PERMISSION_MATRIX
insert into public.role_permissions (tenant_id, role_id, permission_code)
select role.tenant_id, role.id, seed.permission_code
from role_permission_seed seed
join public.roles role on role.code = seed.role_code
on conflict do nothing;

do $$
declare
  enterprise_row record;
  owner_role_id uuid;
  membership_id uuid;
begin
  for enterprise_row in
    select enterprise.id, count(membership.id) filter (where membership.status = 'active') as active_count,
      count(binding.id) as binding_count
    from public.enterprises enterprise
    left join public.enterprise_memberships membership on membership.tenant_id = enterprise.id
    left join public.role_bindings binding on binding.tenant_id = enterprise.id
    group by enterprise.id
  loop
    if enterprise_row.active_count > 1 and enterprise_row.binding_count = 0 then
      raise exception 'Enterprise % has multiple unbound active members; owner bootstrap is ambiguous', enterprise_row.id;
    elsif enterprise_row.active_count = 1 and enterprise_row.binding_count = 0 then
      select id into owner_role_id from public.roles where tenant_id = enterprise_row.id and code = 'enterprise_owner';
      select id into membership_id from public.enterprise_memberships where tenant_id = enterprise_row.id and status = 'active';
      insert into public.role_bindings (tenant_id, role_id, membership_id, scope_kind)
      values (enterprise_row.id, owner_role_id, membership_id, 'enterprise');
    end if;
  end loop;
end;
$$;
