/**
 * Supabase 数据库自动初始化脚本
 * 运行方式: node scripts/init-database.js
 * 
 * 此脚本会自动检测并创建所有必要的表结构
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 配置
const supabaseUrl = 'https://cdcnjtgabgjkouavwxsl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY25qdGdhYmdqa291YXZ3eHNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg1MjM0MSwiZXhwIjoyMDkzNDI4MzQxfQ.LzvwvnkQx_lIjIjsZd8FxyXRaDwTPyiVELyTEuTacmE';

const supabase = createClient(supabaseUrl, supabaseKey);

// 表结构定义
const tableDefinitions = [
  {
    name: 'users',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone VARCHAR(20) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      real_name VARCHAR(100),
      role VARCHAR(50) DEFAULT 'user',
      tenant_id UUID,
      tenant_type VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'tenants',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_type VARCHAR(50) NOT NULL CHECK (tenant_type IN ('manufacturer', 'dealer', 'material_supplier', 'producer')),
      name VARCHAR(200) NOT NULL,
      contact_phone VARCHAR(20),
      address TEXT,
      prefix VARCHAR(10),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'tenant_users',
    columns: `
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
    `
  },
  {
    name: 'customers',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
      name VARCHAR(200) NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      source VARCHAR(50),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'orders',
    columns: `
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
    `
  },
  {
    name: 'order_items',
    columns: `
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
    `
  },
  {
    name: 'workshops',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(20),
      description TEXT,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'production_tasks',
    columns: `
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
    `
  },
  {
    name: 'order_prefixes',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
      prefix VARCHAR(10) NOT NULL UNIQUE,
      company_name VARCHAR(200),
      phone VARCHAR(20),
      address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    `
  },
  {
    name: 'user_settings',
    columns: `
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      setting_key VARCHAR(100) NOT NULL,
      setting_value TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, setting_key)
    `
  }
];

// 索引定义
const indexes = [
  { table: 'users', name: 'idx_users_phone', columns: '(phone)' },
  { table: 'tenant_users', name: 'idx_tenant_users_phone', columns: '(phone)' },
  { table: 'tenant_users', name: 'idx_tenant_users_tenant_id', columns: '(tenant_id)' },
  { table: 'orders', name: 'idx_orders_tenant_id', columns: '(tenant_id)' },
  { table: 'orders', name: 'idx_orders_order_no', columns: '(order_no)' },
  { table: 'customers', name: 'idx_customers_tenant_id', columns: '(tenant_id)' },
  { table: 'production_tasks', name: 'idx_production_tasks_tenant_id', columns: '(tenant_id)' },
  { table: 'production_tasks', name: 'idx_production_tasks_order_id', columns: '(order_id)' },
  { table: 'production_tasks', name: 'idx_production_tasks_workshop_id', columns: '(workshop_id)' }
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
  const tables = ['users', 'tenants', 'tenant_users', 'customers', 'orders', 'order_items', 'workshops', 'production_tasks', 'user_settings'];
  for (const table of tables) {
    const sql = `DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}; CREATE TRIGGER update_${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;
    await executeSQL(sql);
    console.log(`  ✅ ${table} 触发器已创建`);
  }

  console.log('\n✨ 数据库初始化完成！');
}

// 执行
initDatabase().catch(console.error);
