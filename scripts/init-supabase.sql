-- ============================================
-- 闈掑礀鍏ㄥ眿瀹氬埗ERP绯荤粺 - 鏁版嵁搴撳垵濮嬪寲鑴氭湰
-- ============================================

-- 1. 鍒涘缓绯荤粺鐢ㄦ埛琛?(users) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  real_name VARCHAR(100),
  nickname VARCHAR(100),
  avatar_url VARCHAR(512),
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  tenant_id UUID,
  tenant_type VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 鍒涘缓绉熸埛琛?(tenants) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  tenant_type VARCHAR(50) NOT NULL,
  company_name VARCHAR(200),
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  prefix VARCHAR(10),
  address TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 鍒涘缓绉熸埛鐢ㄦ埛琛?(tenant_users) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  department VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

-- 4. 鍒涘缓瀹㈡埛琛?(customers) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  source VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 鍒涘缓璁㈠崟琛?(orders) - matches Drizzle schema (includes target_factory_id, dealer_id)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(50) NOT NULL UNIQUE,
  customer_name VARCHAR(200) NOT NULL,
  customer_phone VARCHAR(20),
  customer_address TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(12, 2) DEFAULT '0',
  deposit_amount DECIMAL(12, 2) DEFAULT '0',
  tenant_id UUID,
  target_factory_id UUID,
  dealer_id UUID,
  delivery_date DATE,
  remark TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 鍒涘缓璁㈠崟椤硅〃 (order_items) - matches Drizzle schema (includes remark)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name VARCHAR(200) NOT NULL,
  specifications TEXT,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT '1',
  unit VARCHAR(20) DEFAULT '浠?,
  unit_price DECIMAL(12, 2) DEFAULT '0',
  subtotal DECIMAL(12, 2) DEFAULT '0',
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 鍒涘缓杞﹂棿琛?(workshops) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  description TEXT,
  tenant_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 鍒涘缓鐢熶骇浠诲姟琛?(production_tasks) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS production_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  task_no VARCHAR(50),
  task_name VARCHAR(200),
  product_name VARCHAR(200) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT '1',
  unit VARCHAR(20) DEFAULT '浠?,
  completed INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  progress VARCHAR(30) DEFAULT 'pending',
  worker_id UUID,
  assigned_to UUID,
  workshop_id UUID,
  tenant_id UUID,
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 鍒涘缓鐢ㄦ埛璁剧疆琛?(user_settings) - matches Drizzle schema (key/value as JSONB)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  key VARCHAR(100) NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- 10. 鍒涘缓璁㈠崟鍓嶇紑琛?(order_prefixes) - matches Drizzle schema (includes name, current_val)
CREATE TABLE IF NOT EXISTS order_prefixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  company_name VARCHAR(200),
  phone VARCHAR(20),
  address TEXT,
  current_val INTEGER DEFAULT 0,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. 鍒涘缓宸ュ巶杞﹂棿琛?(factory_workshops) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS factory_workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  factory_code VARCHAR(20),
  manager VARCHAR(100),
  location VARCHAR(200),
  capacity INTEGER DEFAULT 0,
  current_load INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'normal',
  description TEXT,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 鍒涘缓宸ュ崟琛?(work_orders) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  factory_id UUID,
  workshop_id UUID,
  product_name VARCHAR(200) NOT NULL,
  target_quantity INTEGER NOT NULL,
  completed_quantity INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  start_date TIMESTAMPTZ,
  expected_end_date TIMESTAMPTZ,
  actual_end_date TIMESTAMPTZ,
  tenant_id UUID,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. 鍒涘缓杩涘害鏃ュ織琛?(progress_logs) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL,
  operator_id UUID,
  operator_name VARCHAR(100),
  action VARCHAR(50) NOT NULL,
  completed_delta INTEGER DEFAULT 0,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. 鍒涘缓宸ヤ汉琛?(workers) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. 鍒涘缓渚涘簲鍟嗚〃 (suppliers) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(100),
  category VARCHAR(50),
  rating VARCHAR(10) DEFAULT 'B',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  address TEXT,
  remark TEXT,
  created_by UUID,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. 鍒涘缓缁忛攢鍟嗚〃 (dealers) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(100),
  phone VARCHAR(20),
  region VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  remark TEXT,
  created_by UUID,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. 鍒涘缓鍒嗙被琛?(categories) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. 鍒涘缓浠诲姟琛?(tasks) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  category_id VARCHAR(36) REFERENCES categories(id) ON DELETE CASCADE,
  assignee_id VARCHAR(36),
  assignee_name VARCHAR(128),
  assignee_avatar VARCHAR(512),
  due_date TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. 鍒涘缓閫氱煡琛?(notifications) - matches Drizzle schema
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR(36) REFERENCES tasks(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL DEFAULT 'assignment',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. 鍒涘缓鍒嗙被琛?(categories)
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 鍒涘缓浠诲姟琛?(tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  category_id VARCHAR(36) REFERENCES categories(id) ON DELETE CASCADE,
  assignee_id VARCHAR(36),
  assignee_name VARCHAR(128),
  assignee_avatar VARCHAR(512),
  due_date TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. 鍒涘缓閫氱煡琛?(notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id VARCHAR(36) REFERENCES tasks(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL DEFAULT 'assignment',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 鍒涘缓绱㈠紩
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_tenant_users_phone ON tenant_users(phone);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_tenant_id ON production_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_order_id ON production_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_workshop_id ON production_tasks(workshop_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_worker_id ON production_tasks(worker_id);
CREATE INDEX IF NOT EXISTS idx_factory_workshops_status ON factory_workshops(status);
CREATE INDEX IF NOT EXISTS idx_factory_workshops_tenant_id ON factory_workshops(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_factory_id ON work_orders(factory_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_id ON work_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_work_order_id ON progress_logs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_created_at ON progress_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_workers_worker_no ON workers(worker_no);
CREATE INDEX IF NOT EXISTS idx_workers_craft_type ON workers(craft_type);
CREATE INDEX IF NOT EXISTS idx_workers_workshop_id ON workers(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
CREATE INDEX IF NOT EXISTS idx_workers_tenant_id ON workers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_supplier_code ON suppliers(supplier_code);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dealers_status ON dealers(status);
CREATE INDEX IF NOT EXISTS idx_dealers_region ON dealers(region);
CREATE INDEX IF NOT EXISTS idx_dealers_tenant_id ON dealers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ============================================
-- 鍚敤 RLS 骞跺垱寤?anon 璁块棶绛栫暐
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_anon_select_categories" ON categories FOR SELECT TO anon USING (true);
CREATE POLICY "allow_anon_insert_categories" ON categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_anon_update_categories" ON categories FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_delete_categories" ON categories FOR DELETE TO anon USING (true);

CREATE POLICY "allow_anon_select_tasks" ON tasks FOR SELECT TO anon USING (true);
CREATE POLICY "allow_anon_insert_tasks" ON tasks FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_anon_update_tasks" ON tasks FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_delete_tasks" ON tasks FOR DELETE TO anon USING (true);

CREATE POLICY "allow_anon_select_notifications" ON notifications FOR SELECT TO anon USING (true);
CREATE POLICY "allow_anon_insert_notifications" ON notifications FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_anon_update_notifications" ON notifications FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_anon_delete_notifications" ON notifications FOR DELETE TO anon USING (true);

-- ============================================
-- 鍒涘缓鏇存柊鏃堕棿鎴冲嚱鏁?
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- 涓哄悇琛ㄥ垱寤烘洿鏂版椂闂存埑瑙﹀彂鍣?
-- ============================================
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_users_updated_at ON tenant_users;
CREATE TRIGGER update_tenant_users_updated_at BEFORE UPDATE ON tenant_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_items_updated_at ON order_items;
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workshops_updated_at ON workshops;
CREATE TRIGGER update_workshops_updated_at BEFORE UPDATE ON workshops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_production_tasks_updated_at ON production_tasks;
CREATE TRIGGER update_production_tasks_updated_at BEFORE UPDATE ON production_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_factory_workshops_updated_at ON factory_workshops;
CREATE TRIGGER update_factory_workshops_updated_at BEFORE UPDATE ON factory_workshops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_orders_updated_at ON work_orders;
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workers_updated_at ON workers;
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dealers_updated_at ON dealers;
CREATE TRIGGER update_dealers_updated_at BEFORE UPDATE ON dealers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 鎻掑叆瓒呯骇绠＄悊鍛樿处鍙?
-- ============================================
INSERT INTO users (phone, password, nickname, role, is_active) 
VALUES ('13800000000', '19840214aA', '瓒呯骇绠＄悊鍛?, 'super_admin', true)
ON CONFLICT (phone) DO NOTHING;

-- ============================================
-- 鎻掑叆娴嬭瘯绉熸埛
-- ============================================
INSERT INTO tenants (tenant_type, company_name, contact_phone, prefix, status)
VALUES 
  ('manufacturer', '娴嬭瘯鐢熶骇鍟?, '4001234567', 'SC', 'active'),
  ('dealer', '娴嬭瘯缁忛攢鍟?, '4001234568', 'JX', 'active'),
  ('material_supplier', '娴嬭瘯鏉愭枡鍟?, '4001234569', 'CL', 'active')
ON CONFLICT DO NOTHING;

-- ============================================
-- 鎻掑叆娴嬭瘯绉熸埛璐﹀彿
-- ============================================
DO $$
DECLARE
  mfr_id UUID;
 dlr_id UUID;
  mat_id UUID;
BEGIN
  -- 鑾峰彇鐢熶骇鍟咺D
  SELECT id INTO mfr_id FROM tenants WHERE company_name = '娴嬭瘯鐢熶骇鍟?;
  -- 鑾峰彇缁忛攢鍟咺D
  SELECT id INTO dlr_id FROM tenants WHERE company_name = '娴嬭瘯缁忛攢鍟?;
  -- 鑾峰彇鏉愭枡鍟咺D
  SELECT id INTO mat_id FROM tenants WHERE company_name = '娴嬭瘯鏉愭枡鍟?;
  
  -- 鎻掑叆鐢熶骇鍟嗘祴璇曡处鍙?
  IF mfr_id IS NOT NULL THEN
    INSERT INTO tenant_users (tenant_id, phone, password, name, role, status)
    VALUES (mfr_id, '55556666', '55556666', '鍏ㄦ柊鍏徃', 'user', 'active')
    ON CONFLICT (tenant_id, phone) DO NOTHING;
    
    INSERT INTO tenant_users (tenant_id, phone, password, name, role, status)
    VALUES (mfr_id, '13912345601', 'pass123', '鏉庡洓', '璁㈠崟绠＄悊', 'active')
    ON CONFLICT (tenant_id, phone) DO NOTHING;
  END IF;
  
  -- 鎻掑叆缁忛攢鍟嗘祴璇曡处鍙?
  IF dlr_id IS NOT NULL THEN
    INSERT INTO tenant_users (tenant_id, phone, password, name, role, status)
    VALUES (dlr_id, '66660000', '66660000', '缁忛攢鍟嗙鐞嗗憳', 'user', 'active')
    ON CONFLICT (tenant_id, phone) DO NOTHING;
  END IF;
  
  -- 鎻掑叆鏉愭枡鍟嗘祴璇曡处鍙?
  IF mat_id IS NOT NULL THEN
    INSERT INTO tenant_users (tenant_id, phone, password, name, role, status)
    VALUES (mat_id, '77770000', '77770000', '鏉愭枡鍟嗙鐞嗗憳', 'user', 'active')
    ON CONFLICT (tenant_id, phone) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- 鎻掑叆璁㈠崟鍓嶇紑
-- ============================================
INSERT INTO order_prefixes (tenant_id, prefix, company_name)
SELECT id, 'SC', '娴嬭瘯鐢熶骇鍟? FROM tenants WHERE company_name = '娴嬭瘯鐢熶骇鍟?
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO order_prefixes (tenant_id, prefix, company_name)
SELECT id, 'JX', '娴嬭瘯缁忛攢鍟? FROM tenants WHERE company_name = '娴嬭瘯缁忛攢鍟?
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO order_prefixes (tenant_id, prefix, company_name)
SELECT id, 'CL', '娴嬭瘯鏉愭枡鍟? FROM tenants WHERE company_name = '娴嬭瘯鏉愭枡鍟?
ON CONFLICT (prefix) DO NOTHING;

-- ============================================
-- 杩斿洖鍒涘缓缁撴灉
-- ============================================
SELECT 
  '鏁版嵁搴撳垵濮嬪寲瀹屾垚锛? as message,
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM tenants) as tenants_count,
  (SELECT COUNT(*) FROM tenant_users) as tenant_users_count;

