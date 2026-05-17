-- Idempotent four-level order, production task and wage migration.
-- Safe to run multiple times. It preserves legacy order_modules/order_items/work_orders/progress_logs.

ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);

CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  worker_no VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  gender VARCHAR(10),
  craft_type VARCHAR(50),
  workshop_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  skill_tags JSONB,
  hire_date DATE,
  remark TEXT,
  created_by UUID,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

ALTER TABLE workers ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS workers_user_id_idx ON workers(user_id);
CREATE INDEX IF NOT EXISTS workers_worker_no_idx ON workers(worker_no);
CREATE INDEX IF NOT EXISTS workers_craft_type_idx ON workers(craft_type);
CREATE INDEX IF NOT EXISTS workers_workshop_id_idx ON workers(workshop_id);
CREATE INDEX IF NOT EXISTS workers_status_idx ON workers(status);
CREATE INDEX IF NOT EXISTS workers_tenant_id_idx ON workers(tenant_id);

INSERT INTO workers (user_id, worker_no, name, phone, craft_type, status, tenant_id, created_by, created_at, updated_at)
SELECT
  u.id,
  CONCAT('WK-', RIGHT(REGEXP_REPLACE(COALESCE(u.phone, u.id::TEXT), '[^0-9a-zA-Z]', '', 'g'), 12)),
  COALESCE(u.real_name, u.nickname, u.phone, '工人'),
  u.phone,
  COALESCE(NULLIF(u.department, ''), '生产'),
  'active',
  u.tenant_id,
  u.id,
  NOW(),
  NOW()
FROM users u
LEFT JOIN tenants t ON t.id = u.tenant_id
WHERE u.role = 'employee'
  AND COALESCE(u.tenant_type, t.tenant_type) = 'manufacturer'
  AND NOT EXISTS (SELECT 1 FROM workers w WHERE w.user_id = u.id)
  AND NOT EXISTS (
    SELECT 1
    FROM workers w
    WHERE w.worker_no = CONCAT('WK-', RIGHT(REGEXP_REPLACE(COALESCE(u.phone, u.id::TEXT), '[^0-9a-zA-Z]', '', 'g'), 12))
  );

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cost_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS profit_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_remark TEXT;

CREATE TABLE IF NOT EXISTS order_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  space_no VARCHAR(80) NOT NULL,
  space_name VARCHAR(120) NOT NULL,
  space_type VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT order_spaces_order_space_no_unique UNIQUE(order_id, space_no)
);

CREATE INDEX IF NOT EXISTS order_spaces_order_id_idx ON order_spaces(order_id);
CREATE INDEX IF NOT EXISTS order_spaces_space_no_idx ON order_spaces(space_no);
CREATE INDEX IF NOT EXISTS order_spaces_status_idx ON order_spaces(status);

CREATE TABLE IF NOT EXISTS order_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES order_spaces(id) ON DELETE CASCADE,
  product_no VARCHAR(100) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  product_type VARCHAR(50) NOT NULL DEFAULT 'custom',
  product_model VARCHAR(120),
  width NUMERIC(10, 2),
  height NUMERIC(10, 2),
  depth NUMERIC(10, 2),
  area NUMERIC(12, 4),
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  material VARCHAR(120),
  color VARCHAR(120),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  quoted_amount NUMERIC(12, 2) DEFAULT 0,
  cost_amount NUMERIC(12, 2) DEFAULT 0,
  profit_amount NUMERIC(12, 2) DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 1,
  remark TEXT,
  internal_remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT order_products_order_product_no_unique UNIQUE(order_id, product_no)
);

CREATE INDEX IF NOT EXISTS order_products_order_id_idx ON order_products(order_id);
CREATE INDEX IF NOT EXISTS order_products_space_id_idx ON order_products(space_id);
CREATE INDEX IF NOT EXISTS order_products_product_no_idx ON order_products(product_no);
CREATE INDEX IF NOT EXISTS order_products_status_idx ON order_products(status);

ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS space_id UUID;
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(40) NOT NULL DEFAULT 'process';
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS task_code VARCHAR(80);
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS product_name VARCHAR(200);
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS length NUMERIC(10, 2);
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS width NUMERIC(10, 2);
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS thickness NUMERIC(10, 2);
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS area NUMERIC(12, 4);
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS material VARCHAR(120);
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS color VARCHAR(120);
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS process_name VARCHAR(120);
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS assigned_worker_id UUID;
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS workstation_id UUID;
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS wage_rule_id UUID;
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS estimated_wage_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS final_wage_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE production_tasks ADD COLUMN IF NOT EXISTS approved_by UUID;

CREATE INDEX IF NOT EXISTS production_tasks_space_id_idx ON production_tasks(space_id);
CREATE INDEX IF NOT EXISTS production_tasks_product_id_idx ON production_tasks(product_id);
CREATE INDEX IF NOT EXISTS production_tasks_assigned_worker_id_idx ON production_tasks(assigned_worker_id);
CREATE INDEX IF NOT EXISTS production_tasks_status_idx ON production_tasks(status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_tasks_space_id_fkey') THEN
    ALTER TABLE production_tasks ADD CONSTRAINT production_tasks_space_id_fkey FOREIGN KEY (space_id) REFERENCES order_spaces(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_tasks_product_id_fkey') THEN
    ALTER TABLE production_tasks ADD CONSTRAINT production_tasks_product_id_fkey FOREIGN KEY (product_id) REFERENCES order_products(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_tasks_assigned_worker_id_fkey') THEN
    ALTER TABLE production_tasks ADD CONSTRAINT production_tasks_assigned_worker_id_fkey FOREIGN KEY (assigned_worker_id) REFERENCES workers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wage_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  rule_name VARCHAR(160) NOT NULL,
  task_type VARCHAR(40) NOT NULL,
  process_name VARCHAR(120),
  unit VARCHAR(20) NOT NULL DEFAULT '件',
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  calculation_method VARCHAR(40) NOT NULL DEFAULT 'by_piece',
  role_scope VARCHAR(80),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wage_rules_tenant_id_idx ON wage_rules(tenant_id);
CREATE INDEX IF NOT EXISTS wage_rules_task_type_idx ON wage_rules(task_type);
CREATE INDEX IF NOT EXISTS wage_rules_enabled_idx ON wage_rules(enabled);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'production_tasks_wage_rule_id_fkey') THEN
    ALTER TABLE production_tasks ADD CONSTRAINT production_tasks_wage_rule_id_fkey FOREIGN KEY (wage_rule_id) REFERENCES wage_rules(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS worker_wage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  space_id UUID REFERENCES order_spaces(id) ON DELETE SET NULL,
  product_id UUID REFERENCES order_products(id) ON DELETE SET NULL,
  task_id UUID NOT NULL REFERENCES production_tasks(id) ON DELETE CASCADE,
  wage_rule_id UUID REFERENCES wage_rules(id) ON DELETE SET NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  wage_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT worker_wage_records_task_unique UNIQUE(task_id)
);

CREATE INDEX IF NOT EXISTS worker_wage_records_worker_id_idx ON worker_wage_records(worker_id);
CREATE INDEX IF NOT EXISTS worker_wage_records_task_id_idx ON worker_wage_records(task_id);
CREATE INDEX IF NOT EXISTS worker_wage_records_order_id_idx ON worker_wage_records(order_id);
CREATE INDEX IF NOT EXISTS worker_wage_records_status_idx ON worker_wage_records(status);

CREATE TABLE IF NOT EXISTS order_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(40) NOT NULL,
  target_id UUID NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  remark TEXT
);

CREATE INDEX IF NOT EXISTS order_status_logs_target_idx ON order_status_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS order_status_logs_changed_at_idx ON order_status_logs(changed_at);

INSERT INTO order_spaces (order_id, space_no, space_name, space_type, sort_order, status, remark, created_at, updated_at)
SELECT
  m.order_id,
  REPLACE(m.module_no, '-M', '-S') AS space_no,
  m.module_name,
  'legacy',
  m.sort_order,
  COALESCE(o.status, 'draft'),
  m.remark,
  m.created_at,
  m.updated_at
FROM order_modules m
JOIN orders o ON o.id = m.order_id
WHERE NOT EXISTS (
  SELECT 1 FROM order_spaces s WHERE s.order_id = m.order_id AND s.space_no = REPLACE(m.module_no, '-M', '-S')
);

INSERT INTO order_products (
  order_id, space_id, product_no, product_name, product_type, width, height, depth,
  quantity, material, color, status, quoted_amount, cost_amount, profit_amount,
  sort_order, remark, created_at, updated_at
)
SELECT
  i.order_id,
  s.id,
  REPLACE(COALESCE(i.item_no, CONCAT(s.space_no, '-P', LPAD(i.sort_order::TEXT, 2, '0'))), '-I', '-P') AS product_no,
  i.product_name,
  CASE WHEN i.hardware IS NOT NULL AND i.hardware <> '' THEN 'hardware' ELSE 'custom' END,
  i.width_mm,
  i.length_mm,
  i.thickness_mm,
  i.quantity,
  i.specifications,
  i.color,
  COALESCE(o.status, 'draft'),
  COALESCE(i.subtotal, 0),
  0,
  0,
  i.sort_order,
  i.remark,
  i.created_at,
  i.updated_at
FROM order_items i
JOIN order_modules m ON m.id = i.module_id
JOIN order_spaces s ON s.order_id = i.order_id AND s.space_no = REPLACE(m.module_no, '-M', '-S')
JOIN orders o ON o.id = i.order_id
WHERE NOT EXISTS (
  SELECT 1
  FROM order_products p
  WHERE p.order_id = i.order_id
    AND p.product_no = REPLACE(COALESCE(i.item_no, CONCAT(s.space_no, '-P', LPAD(i.sort_order::TEXT, 2, '0'))), '-I', '-P')
);

ALTER TABLE order_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE wage_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_wage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_order_spaces" ON order_spaces;
CREATE POLICY "service_role_order_spaces" ON order_spaces FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_order_products" ON order_products;
CREATE POLICY "service_role_order_products" ON order_products FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_wage_rules" ON wage_rules;
CREATE POLICY "service_role_wage_rules" ON wage_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_worker_wage_records" ON worker_wage_records;
CREATE POLICY "service_role_worker_wage_records" ON worker_wage_records FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_order_status_logs" ON order_status_logs;
CREATE POLICY "service_role_order_status_logs" ON order_status_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
