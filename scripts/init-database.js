/**
 * Supabase 数据库自动初始化脚本
 * 运行方式: node scripts/init-database.js
 *
 * 此脚本会自动检测并创建所有必要的表结构。
 * 表结构定义与 src/db/schema.ts 保持一致。
 *
 * 约束:
 * - 字段名使用 snake_case
 * - 外键使用 ON DELETE CASCADE 或 SET NULL
 * - 所有外键、过滤字段、排序字段均有索引
 * - health_check 表禁止删除
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 配置
const supabaseUrl = process.env.COZE_SUPABASE_URL || 'https://cdcnjtgabgjkouavwxsl.supabase.co';
const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// 表结构定义 - 与 src/db/schema.ts 对齐
const tableDefinitions = [
  // ============================================================================
  // 系统表
  // ============================================================================
  {
    name: 'health_check',
    columns: `
      id SERIAL PRIMARY KEY,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },

  // ============================================================================
  // 用户与租户
  // ============================================================================
  {
    name: 'users',
    columns: `
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
    `
  },
  {
    name: 'tenants',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      tenant_type VARCHAR(50) NOT NULL CHECK (tenant_type IN ('manufacturer', 'dealer', 'material_supplier', 'producer')),
      company_name VARCHAR(200),
      contact_person VARCHAR(100),
      contact_phone VARCHAR(20),
      prefix VARCHAR(10),
      address TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'tenant_users',
    columns: `
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
    `
  },

  // ============================================================================
  // 订单与客户
  // ============================================================================
  {
    name: 'customers',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      source VARCHAR(50),
      status VARCHAR(20) DEFAULT 'active',
      tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'orders',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_no VARCHAR(50) NOT NULL UNIQUE,
      customer_name VARCHAR(200) NOT NULL,
      customer_phone VARCHAR(20),
      customer_address TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      total_amount DECIMAL(12, 2) DEFAULT 0,
      deposit_amount DECIMAL(12, 2) DEFAULT 0,
      tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
      target_factory_id UUID,
      dealer_id UUID,
      delivery_date DATE,
      remark TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'order_items',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name VARCHAR(200) NOT NULL,
      specifications TEXT,
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
      unit VARCHAR(20) DEFAULT '件',
      unit_price DECIMAL(12, 2) DEFAULT 0,
      subtotal DECIMAL(12, 2) DEFAULT 0,
      remark TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'order_prefixes',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prefix VARCHAR(10) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      company_name VARCHAR(200),
      phone VARCHAR(20),
      address TEXT,
      current_val INTEGER DEFAULT 0,
      tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `
  },

  // ============================================================================
  // 生产与车间
  // ============================================================================
  {
    name: 'workshops',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      code VARCHAR(20),
      description TEXT,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'factory_workshops',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      factory_code VARCHAR(20),
      manager VARCHAR(100),
      location VARCHAR(200),
      capacity INTEGER DEFAULT 0,
      current_load INTEGER DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'normal',
      description TEXT,
      tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'production_tasks',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
      task_no VARCHAR(50),
      task_name VARCHAR(200),
      product_name VARCHAR(200) NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
      unit VARCHAR(20) DEFAULT '件',
      completed INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      progress VARCHAR(30) DEFAULT 'pending',
      worker_id UUID,
      assigned_to UUID,
      workshop_id UUID REFERENCES workshops(id) ON DELETE SET NULL,
      tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
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
    `
  },

  // ============================================================================
  // 生产进度跟踪
  // ============================================================================
  {
    name: 'work_orders',
    columns: `
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
    `
  },
  {
    name: 'progress_logs',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      operator_id UUID,
      operator_name VARCHAR(100),
      action VARCHAR(50) NOT NULL,
      completed_delta INTEGER DEFAULT 0,
      remark TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `
  },

  // ============================================================================
  // 工人管理
  // ============================================================================
  {
    name: 'workers',
    columns: `
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
    `
  },

  // ============================================================================
  // 供应商管理
  // ============================================================================
  {
    name: 'suppliers',
    columns: `
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
    `
  },

  // ============================================================================
  // 经销商管理
  // ============================================================================
  {
    name: 'dealers',
    columns: `
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
    `
  },

  // ============================================================================
  // 任务管理 & 通知
  // ============================================================================
  {
    name: 'categories',
    columns: `
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(128) NOT NULL,
      color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'tasks',
    columns: `
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
    `
  },
  {
    name: 'notifications',
    columns: `
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id VARCHAR(36) REFERENCES tasks(id) ON DELETE CASCADE,
      type VARCHAR(30) NOT NULL DEFAULT 'assignment',
      title VARCHAR(255) NOT NULL,
      message TEXT,
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `
  },
  {
    name: 'user_settings',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      key VARCHAR(100) NOT NULL,
      value JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, key)
    `
  }
];

// 索引定义
const indexes = [
  // users
  { table: 'users', name: 'idx_users_phone', columns: '(phone)' },
  { table: 'users', name: 'idx_users_tenant_id', columns: '(tenant_id)' },
  // tenants
  { table: 'tenants', name: 'idx_tenants_tenant_type', columns: '(tenant_type)' },
  { table: 'tenants', name: 'idx_tenants_prefix', columns: '(prefix)' },
  // tenant_users
  { table: 'tenant_users', name: 'idx_tenant_users_tenant_id', columns: '(tenant_id)' },
  // orders
  { table: 'orders', name: 'idx_orders_tenant_id', columns: '(tenant_id)' },
  { table: 'orders', name: 'idx_orders_status', columns: '(status)' },
  { table: 'orders', name: 'idx_orders_created_by', columns: '(created_by)' },
  // order_items
  { table: 'order_items', name: 'idx_order_items_order_id', columns: '(order_id)' },
  // customers
  { table: 'customers', name: 'idx_customers_tenant_id', columns: '(tenant_id)' },
  // workshops
  { table: 'workshops', name: 'idx_workshops_tenant_id', columns: '(tenant_id)' },
  // factory_workshops
  { table: 'factory_workshops', name: 'idx_factory_workshops_status', columns: '(status)' },
  { table: 'factory_workshops', name: 'idx_factory_workshops_tenant_id', columns: '(tenant_id)' },
  // production_tasks
  { table: 'production_tasks', name: 'idx_production_tasks_tenant_id', columns: '(tenant_id)' },
  { table: 'production_tasks', name: 'idx_production_tasks_order_id', columns: '(order_id)' },
  { table: 'production_tasks', name: 'idx_production_tasks_workshop_id', columns: '(workshop_id)' },
  { table: 'production_tasks', name: 'idx_production_tasks_worker_id', columns: '(worker_id)' },
  // work_orders
  { table: 'work_orders', name: 'idx_work_orders_status', columns: '(status)' },
  { table: 'work_orders', name: 'idx_work_orders_factory_id', columns: '(factory_id)' },
  { table: 'work_orders', name: 'idx_work_orders_tenant_id', columns: '(tenant_id)' },
  // progress_logs
  { table: 'progress_logs', name: 'idx_progress_logs_work_order_id', columns: '(work_order_id)' },
  { table: 'progress_logs', name: 'idx_progress_logs_created_at', columns: '(created_at)' },
  // workers
  { table: 'workers', name: 'idx_workers_worker_no', columns: '(worker_no)' },
  { table: 'workers', name: 'idx_workers_craft_type', columns: '(craft_type)' },
  { table: 'workers', name: 'idx_workers_workshop_id', columns: '(workshop_id)' },
  { table: 'workers', name: 'idx_workers_status', columns: '(status)' },
  { table: 'workers', name: 'idx_workers_tenant_id', columns: '(tenant_id)' },
  // suppliers
  { table: 'suppliers', name: 'idx_suppliers_supplier_code', columns: '(supplier_code)' },
  { table: 'suppliers', name: 'idx_suppliers_category', columns: '(category)' },
  { table: 'suppliers', name: 'idx_suppliers_status', columns: '(status)' },
  { table: 'suppliers', name: 'idx_suppliers_tenant_id', columns: '(tenant_id)' },
  // dealers
  { table: 'dealers', name: 'idx_dealers_status', columns: '(status)' },
  { table: 'dealers', name: 'idx_dealers_region', columns: '(region)' },
  { table: 'dealers', name: 'idx_dealers_tenant_id', columns: '(tenant_id)' },
  // categories
  { table: 'categories', name: 'idx_categories_name', columns: '(name)' },
  // tasks
  { table: 'tasks', name: 'idx_tasks_category_id', columns: '(category_id)' },
  { table: 'tasks', name: 'idx_tasks_status', columns: '(status)' },
  { table: 'tasks', name: 'idx_tasks_completed', columns: '(completed)' },
  { table: 'tasks', name: 'idx_tasks_created_at', columns: '(created_at)' },
  { table: 'tasks', name: 'idx_tasks_assignee_id', columns: '(assignee_id)' },
  { table: 'tasks', name: 'idx_tasks_priority', columns: '(priority)' },
  { table: 'tasks', name: 'idx_tasks_due_date', columns: '(due_date)' },
  // notifications
  { table: 'notifications', name: 'idx_notifications_task_id', columns: '(task_id)' },
  { table: 'notifications', name: 'idx_notifications_type', columns: '(type)' },
  { table: 'notifications', name: 'idx_notifications_read', columns: '(read)' },
  { table: 'notifications', name: 'idx_notifications_created_at', columns: '(created_at)' },
];

// 触发器函数
const triggerFunction = `
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

async function executeSQL(sql) {
  try {
    const { data, error } = await supabase.rpc('exec', { sql });
    if (error) {
      console.log(`  ⚠️ ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.log(`  ⚠️ ${e.message}`);
    return false;
  }
}

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);
    return !error;
  } catch (e) {
    return false;
  }
}

async function initDatabase() {
  console.log('🚀 开始初始化数据库...\n');

  // 1. 创建 exec 函数（如果不存在）
  console.log('📦 创建 exec 函数...');
  const execFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec(sql TEXT)
    RETURNS void AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  await executeSQL(execFunctionSQL);
  console.log('  ✅ exec 函数已创建\n');

  // 2. 创建表
  console.log('📦 创建表结构...');
  for (const table of tableDefinitions) {
    const exists = await checkTableExists(table.name);
    if (exists) {
      console.log(`  ⏭️  表 ${table.name} 已存在，跳过`);
    } else {
      const sql = `CREATE TABLE IF NOT EXISTS ${table.name} (${table.columns});`;
      const success = await executeSQL(sql);
      if (success) {
        console.log(`  ✅ 表 ${table.name} 创建成功`);
      }
    }
  }

  // 3. 创建索引
  console.log('\n📦 创建索引...');
  for (const idx of indexes) {
    const sql = `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table} ${idx.columns};`;
    await executeSQL(sql);
    console.log(`  ✅ 索引 ${idx.name} 已创建`);
  }

  // 4. 创建触发器
  console.log('\n📦 创建触发器...');
  await executeSQL(triggerFunction);
  const triggerTables = [
    'users', 'tenants', 'tenant_users', 'customers', 'orders', 'order_items',
    'workshops', 'factory_workshops', 'production_tasks', 'work_orders',
    'workers', 'suppliers', 'dealers', 'categories', 'tasks', 'user_settings',
  ];
  for (const table of triggerTables) {
    const sql = `DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}; CREATE TRIGGER update_${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;
    await executeSQL(sql);
    console.log(`  ✅ ${table} 触发器已创建`);
  }

  console.log('\n✨ 数据库初始化完成！');
}

// 执行
initDatabase().catch(console.error);
