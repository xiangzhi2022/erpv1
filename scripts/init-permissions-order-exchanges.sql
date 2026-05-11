-- Idempotent RBAC and order exchange tables.
-- Run with a privileged Supabase/Postgres connection.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_type VARCHAR(50);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS prefix VARCHAR(10);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'type'
  ) THEN
    UPDATE tenants
    SET tenant_type = COALESCE(
      tenant_type,
      CASE
        WHEN type = 'producer' THEN 'manufacturer'
        WHEN type = 'distributor' THEN 'dealer'
        WHEN type = 'supplier' THEN 'material_supplier'
        ELSE type
      END,
      'manufacturer'
    )
    WHERE tenant_type IS NULL;
  ELSE
    UPDATE tenants
    SET tenant_type = COALESCE(tenant_type, 'manufacturer')
    WHERE tenant_type IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'order_prefix'
  ) THEN
    UPDATE tenants
    SET prefix = COALESCE(prefix, order_prefix)
    WHERE prefix IS NULL;
  END IF;
END $$;

UPDATE tenants
SET company_name = COALESCE(company_name, name)
WHERE company_name IS NULL;

ALTER TABLE tenants ALTER COLUMN tenant_type SET DEFAULT 'manufacturer';
ALTER TABLE tenants ALTER COLUMN tenant_type SET NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_type VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);

ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member';
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE users
SET is_active = COALESCE(is_active, status IS NULL OR status = 'active')
WHERE is_active IS NULL;

ALTER TABLE users ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE users ALTER COLUMN is_active SET NOT NULL;

UPDATE users
SET tenant_type = tenants.tenant_type
FROM tenants
WHERE users.tenant_id = tenants.id
  AND users.tenant_type IS NULL;

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  permission_key VARCHAR(80) NOT NULL,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_permissions_user_key_unique UNIQUE (user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_tenant_id ON user_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_key ON user_permissions(permission_key);

CREATE TABLE IF NOT EXISTS order_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  to_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(40) NOT NULL DEFAULT 'sent',
  message TEXT,
  proposed_changes JSONB,
  handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT order_exchanges_status_check CHECK (
    status IN ('draft', 'sent', 'accepted', 'change_requested', 'rejected', 'cancelled', 'completed')
  )
);

CREATE INDEX IF NOT EXISTS idx_order_exchanges_order_id ON order_exchanges(order_id);
CREATE INDEX IF NOT EXISTS idx_order_exchanges_from_tenant_id ON order_exchanges(from_tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_exchanges_to_tenant_id ON order_exchanges(to_tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_exchanges_status ON order_exchanges(status);
CREATE INDEX IF NOT EXISTS idx_order_exchanges_created_at ON order_exchanges(created_at);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_exchanges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_user_permissions" ON user_permissions;
CREATE POLICY "service_role_user_permissions"
  ON user_permissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_order_exchanges" ON order_exchanges;
CREATE POLICY "service_role_order_exchanges"
  ON order_exchanges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO user_permissions (user_id, tenant_id, permission_key)
SELECT id, tenant_id,
  CASE
    WHEN role = 'order_manager' THEN 'factory_order_manager'
    WHEN role = 'finance' THEN 'factory_finance'
    WHEN role = 'sales' THEN 'factory_sales'
    WHEN role = 'warehouse_shipping' THEN 'factory_shipping'
    WHEN role = 'factory_user' THEN 'factory_general_worker'
    WHEN role = 'worker' AND department = U&'\6728\5DE5' THEN 'factory_carpenter'
    WHEN role = 'worker' AND department = U&'\6253\78E8' THEN 'factory_polisher'
    WHEN role = 'worker' AND department = U&'\8D34\76AE' THEN 'factory_veneer'
    WHEN role = 'worker' AND department = U&'\55B7\6F06' THEN 'factory_painter'
    WHEN role = 'worker' AND department = U&'\8D28\68C0' THEN 'factory_quality'
    WHEN role = 'worker' AND department = U&'\6253\5305' THEN 'factory_packer'
    WHEN role = 'worker' THEN 'factory_general_worker'
    ELSE NULL
  END
FROM users
WHERE role IN ('order_manager', 'finance', 'sales', 'warehouse_shipping', 'factory_user', 'worker')
ON CONFLICT (user_id, permission_key) DO NOTHING;

UPDATE users
SET role = 'employee'
WHERE role IN ('order_manager', 'finance', 'sales', 'warehouse_shipping', 'factory_user', 'worker', 'user');

WITH specific_worker_permissions AS (
  SELECT id AS user_id, tenant_id,
    CASE
      WHEN department = U&'\6728\5DE5' THEN 'factory_carpenter'
      WHEN department = U&'\6253\78E8' THEN 'factory_polisher'
      WHEN department = U&'\8D34\76AE' THEN 'factory_veneer'
      WHEN department = U&'\55B7\6F06' THEN 'factory_painter'
      WHEN department = U&'\8D28\68C0' THEN 'factory_quality'
      WHEN department = U&'\6253\5305' THEN 'factory_packer'
      ELSE NULL
    END AS permission_key
  FROM users
  WHERE department IN (
    U&'\6728\5DE5',
    U&'\6253\78E8',
    U&'\8D34\76AE',
    U&'\55B7\6F06',
    U&'\8D28\68C0',
    U&'\6253\5305'
  )
)
INSERT INTO user_permissions (user_id, tenant_id, permission_key)
SELECT user_id, tenant_id, permission_key
FROM specific_worker_permissions
WHERE permission_key IS NOT NULL
ON CONFLICT (user_id, permission_key) DO NOTHING;

DELETE FROM user_permissions up
USING users u
WHERE up.user_id = u.id
  AND up.permission_key = 'factory_general_worker'
  AND u.department IN (
    U&'\6728\5DE5',
    U&'\6253\78E8',
    U&'\8D34\76AE',
    U&'\55B7\6F06',
    U&'\8D28\68C0',
    U&'\6253\5305'
  )
  AND EXISTS (
    SELECT 1
    FROM user_permissions specific
    WHERE specific.user_id = u.id
      AND specific.permission_key <> 'factory_general_worker'
  );
