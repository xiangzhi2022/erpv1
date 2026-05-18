-- Organization, employees, positions, and role/permission foundation.
-- Safe to run repeatedly against the existing Supabase PostgreSQL database.

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  code VARCHAR(80) NOT NULL,
  parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  tenant_id UUID,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  code VARCHAR(80) NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  position_type VARCHAR(50) NOT NULL DEFAULT 'general',
  can_receive_production_task BOOLEAN NOT NULL DEFAULT false,
  can_calculate_piece_wage BOOLEAN NOT NULL DEFAULT false,
  can_review_task BOOLEAN NOT NULL DEFAULT false,
  can_assign_task BOOLEAN NOT NULL DEFAULT false,
  default_role_code VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  tenant_id UUID,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  employee_no VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(120),
  avatar_url VARCHAR(512),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  primary_position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
  employee_type VARCHAR(50) NOT NULL DEFAULT 'full_time',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  hire_date DATE,
  leave_date DATE,
  base_salary NUMERIC(12, 2) DEFAULT 0,
  tenant_id UUID,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS employee_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_positions_unique UNIQUE(employee_id, position_id)
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  code VARCHAR(80) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  code VARCHAR(100) NOT NULL,
  module VARCHAR(80) NOT NULL,
  permission_type VARCHAR(40) NOT NULL DEFAULT 'route',
  description TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_permissions_unique UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS employee_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT employee_roles_unique UNIQUE(employee_id, role_id)
);

ALTER TABLE workers ADD COLUMN IF NOT EXISTS can_receive_production_task BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS can_calculate_piece_wage BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE worker_wage_records DROP CONSTRAINT IF EXISTS worker_wage_records_status_check;

CREATE INDEX IF NOT EXISTS departments_code_idx ON departments(code);
CREATE INDEX IF NOT EXISTS departments_parent_id_idx ON departments(parent_id);
CREATE INDEX IF NOT EXISTS departments_tenant_id_idx ON departments(tenant_id);
CREATE INDEX IF NOT EXISTS positions_code_idx ON positions(code);
CREATE INDEX IF NOT EXISTS positions_department_id_idx ON positions(department_id);
CREATE INDEX IF NOT EXISTS positions_tenant_id_idx ON positions(tenant_id);
CREATE INDEX IF NOT EXISTS employees_employee_no_idx ON employees(employee_no);
CREATE INDEX IF NOT EXISTS employees_user_id_idx ON employees(user_id);
CREATE INDEX IF NOT EXISTS employees_department_id_idx ON employees(department_id);
CREATE INDEX IF NOT EXISTS employees_primary_position_id_idx ON employees(primary_position_id);
CREATE INDEX IF NOT EXISTS employees_tenant_id_idx ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS roles_code_idx ON roles(code);
CREATE INDEX IF NOT EXISTS roles_tenant_id_idx ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS permissions_code_idx ON permissions(code);
CREATE INDEX IF NOT EXISTS permissions_module_idx ON permissions(module);

INSERT INTO departments (name, code, sort_order)
VALUES
  ('管理层', 'management', 10),
  ('生产部', 'production', 20),
  ('财务部', 'finance', 30),
  ('业务部', 'business', 40),
  ('仓储部', 'warehouse', 50),
  ('行政部', 'administration', 60),
  ('质检部', 'quality', 70),
  ('发货部', 'delivery', 80)
ON CONFLICT DO NOTHING;

INSERT INTO roles (name, code, description)
VALUES
  ('管理员', 'admin', '系统管理'),
  ('老板', 'boss', '查看和管理全部业务'),
  ('生产主管', 'production_manager', '生产任务分配和审核'),
  ('工人', 'worker', '个人生产任务和工资'),
  ('财务', 'finance', '财务和工资结算'),
  ('录入员', 'data_entry', '订单基础资料录入'),
  ('经销商', 'dealer', '经销商订单跟踪'),
  ('仓库', 'warehouse', '仓储管理'),
  ('质检员', 'quality_inspector', '质检任务'),
  ('发货员', 'delivery_staff', '发货管理'),
  ('业务员', 'business_staff', '业务订单')
ON CONFLICT DO NOTHING;

WITH department_codes AS (
  SELECT id, code FROM departments
)
INSERT INTO positions (
  name,
  code,
  department_id,
  position_type,
  can_receive_production_task,
  can_calculate_piece_wage,
  can_review_task,
  can_assign_task,
  default_role_code
)
VALUES
  ('开料工', 'cutting_worker', (SELECT id FROM department_codes WHERE code = 'production'), 'production_worker', true, true, false, false, 'worker'),
  ('封边工', 'edge_banding_worker', (SELECT id FROM department_codes WHERE code = 'production'), 'production_worker', true, true, false, false, 'worker'),
  ('打孔工', 'drilling_worker', (SELECT id FROM department_codes WHERE code = 'production'), 'production_worker', true, true, false, false, 'worker'),
  ('组装工', 'assembly_worker', (SELECT id FROM department_codes WHERE code = 'production'), 'production_worker', true, true, false, false, 'worker'),
  ('安装工', 'installation_worker', (SELECT id FROM department_codes WHERE code = 'production'), 'production_worker', true, true, false, false, 'worker'),
  ('包装工', 'packaging_worker', (SELECT id FROM department_codes WHERE code = 'production'), 'production_worker', true, true, false, false, 'worker'),
  ('生产主管', 'production_manager', (SELECT id FROM department_codes WHERE code = 'production'), 'production_manager', false, false, true, true, 'production_manager'),
  ('车间主任', 'workshop_director', (SELECT id FROM department_codes WHERE code = 'production'), 'production_manager', false, false, true, true, 'production_manager'),
  ('排产员', 'scheduler', (SELECT id FROM department_codes WHERE code = 'production'), 'production_manager', false, false, false, true, 'production_manager'),
  ('组长', 'team_leader', (SELECT id FROM department_codes WHERE code = 'production'), 'production_manager', true, true, true, true, 'production_manager'),
  ('质检员', 'quality_inspector', (SELECT id FROM department_codes WHERE code = 'quality'), 'quality', true, false, true, false, 'quality_inspector'),
  ('财务', 'finance_staff', (SELECT id FROM department_codes WHERE code = 'finance'), 'finance', false, false, false, false, 'finance'),
  ('录入员', 'data_entry', (SELECT id FROM department_codes WHERE code = 'administration'), 'data_entry', false, false, false, false, 'data_entry'),
  ('仓库管理员', 'warehouse_keeper', (SELECT id FROM department_codes WHERE code = 'warehouse'), 'warehouse', false, false, false, false, 'warehouse'),
  ('发货员', 'delivery_staff', (SELECT id FROM department_codes WHERE code = 'delivery'), 'delivery', false, false, false, false, 'delivery_staff'),
  ('采购', 'purchaser', (SELECT id FROM department_codes WHERE code = 'business'), 'purchasing', false, false, false, false, 'business_staff'),
  ('客服', 'customer_service', (SELECT id FROM department_codes WHERE code = 'business'), 'service', false, false, false, false, 'business_staff'),
  ('老板', 'boss', (SELECT id FROM department_codes WHERE code = 'management'), 'management', false, false, true, true, 'boss'),
  ('系统管理员', 'system_admin', (SELECT id FROM department_codes WHERE code = 'management'), 'admin', false, false, true, true, 'admin')
ON CONFLICT DO NOTHING;
