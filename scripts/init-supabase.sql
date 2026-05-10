-- ============================================
-- 青崖全屋定制ERP系统 - 数据库初始化脚本
-- ============================================

-- 1. 创建系统用户表 (users) - 官方管理员
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user',
  tenant_type VARCHAR(50),
  tenant_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建租户表 (tenants)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_type VARCHAR(50) NOT NULL CHECK (tenant_type IN ('manufacturer', 'dealer', 'material_supplier')),
  company_name VARCHAR(200) NOT NULL,
  contact_phone VARCHAR(20),
  address TEXT,
  prefix VARCHAR(10),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建租户用户表 (tenant_users)
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'user',
  department VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

-- 4. 创建客户表 (customers)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  source VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 创建订单表 (orders)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  order_no VARCHAR(50) NOT NULL,
  customer_name VARCHAR(200),
  customer_phone VARCHAR(20),
  customer_address TEXT,
  total_amount DECIMAL(12, 2) DEFAULT 0,
  deposit_amount DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  delivery_date DATE,
  remark TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, order_no)
);

-- 6. 创建订单项表 (order_items)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name VARCHAR(200),
  specifications TEXT,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit VARCHAR(20),
  unit_price DECIMAL(12, 2) DEFAULT 0,
  subtotal DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 创建车间表 (workshops)
CREATE TABLE IF NOT EXISTS workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 创建生产任务表 (production_tasks)
CREATE TABLE IF NOT EXISTS production_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  task_no VARCHAR(50),
  workshop_id UUID REFERENCES workshops(id) ON DELETE SET NULL,
  task_name VARCHAR(200),
  assigned_to UUID,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit VARCHAR(20),
  status VARCHAR(50) DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  progress INTEGER DEFAULT 0,
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 创建用户设置表 (user_settings)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, setting_key)
);

-- 10. 创建订单前缀表 (order_prefixes)
CREATE TABLE IF NOT EXISTS order_prefixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  prefix VARCHAR(10) NOT NULL UNIQUE,
  company_name VARCHAR(200),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. 创建分类表 (categories)
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(128) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 创建任务表 (tasks)
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

-- 13. 创建通知表 (notifications)
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
-- 创建索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_tenant_users_phone ON tenant_users(phone);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_tenant_id ON production_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_order_id ON production_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_workshop_id ON production_tasks(workshop_id);
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
-- 启用 RLS 并创建 anon 访问策略
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
-- 创建更新时间戳函数
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- 为各表创建更新时间戳触发器
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

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 插入超级管理员账号
-- ============================================
INSERT INTO users (phone, password, nickname, role, is_active) 
VALUES ('13800000000', '19840214aA', '超级管理员', 'super_admin', true)
ON CONFLICT (phone) DO NOTHING;

-- ============================================
-- 插入测试租户
-- ============================================
INSERT INTO tenants (tenant_type, company_name, contact_phone, prefix, status)
VALUES 
  ('manufacturer', '测试生产商', '4001234567', 'SC', 'active'),
  ('dealer', '测试经销商', '4001234568', 'JX', 'active'),
  ('material_supplier', '测试材料商', '4001234569', 'CL', 'active')
ON CONFLICT DO NOTHING;

-- ============================================
-- 插入测试租户账号
-- ============================================
DO $$
DECLARE
  mfr_id UUID;
 dlr_id UUID;
  mat_id UUID;
BEGIN
  -- 获取生产商ID
  SELECT id INTO mfr_id FROM tenants WHERE company_name = '测试生产商';
  -- 获取经销商ID
  SELECT id INTO dlr_id FROM tenants WHERE company_name = '测试经销商';
  -- 获取材料商ID
  SELECT id INTO mat_id FROM tenants WHERE company_name = '测试材料商';
  
  -- 插入生产商测试账号
  IF mfr_id IS NOT NULL THEN
    INSERT INTO tenant_users (tenant_id, phone, password, name, role, status)
    VALUES (mfr_id, '55556666', '55556666', '全新公司', 'user', 'active')
    ON CONFLICT (tenant_id, phone) DO NOTHING;
    
    INSERT INTO tenant_users (tenant_id, phone, password, name, role, status)
    VALUES (mfr_id, '13912345601', 'pass123', '李四', '订单管理', 'active')
    ON CONFLICT (tenant_id, phone) DO NOTHING;
  END IF;
  
  -- 插入经销商测试账号
  IF dlr_id IS NOT NULL THEN
    INSERT INTO tenant_users (tenant_id, phone, password, name, role, status)
    VALUES (dlr_id, '66660000', '66660000', '经销商管理员', 'user', 'active')
    ON CONFLICT (tenant_id, phone) DO NOTHING;
  END IF;
  
  -- 插入材料商测试账号
  IF mat_id IS NOT NULL THEN
    INSERT INTO tenant_users (tenant_id, phone, password, name, role, status)
    VALUES (mat_id, '77770000', '77770000', '材料商管理员', 'user', 'active')
    ON CONFLICT (tenant_id, phone) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- 插入订单前缀
-- ============================================
INSERT INTO order_prefixes (tenant_id, prefix, company_name)
SELECT id, 'SC', '测试生产商' FROM tenants WHERE company_name = '测试生产商'
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO order_prefixes (tenant_id, prefix, company_name)
SELECT id, 'JX', '测试经销商' FROM tenants WHERE company_name = '测试经销商'
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO order_prefixes (tenant_id, prefix, company_name)
SELECT id, 'CL', '测试材料商' FROM tenants WHERE company_name = '测试材料商'
ON CONFLICT (prefix) DO NOTHING;

-- ============================================
-- 返回创建结果
-- ============================================
SELECT 
  '数据库初始化完成！' as message,
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM tenants) as tenants_count,
  (SELECT COUNT(*) FROM tenant_users) as tenant_users_count;
