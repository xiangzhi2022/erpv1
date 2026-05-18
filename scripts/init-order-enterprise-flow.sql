-- Idempotent enterprise order flow and hierarchical order detail migration.
-- Safe to run multiple times against Supabase/Postgres.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_flow VARCHAR(40) DEFAULT 'legacy';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS from_tenant_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS to_tenant_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_parent_order_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_parent_order_id_fkey
      FOREIGN KEY (parent_order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE orders
SET
  from_tenant_id = COALESCE(from_tenant_id, tenant_id, dealer_id),
  to_tenant_id = COALESCE(to_tenant_id, target_factory_id),
  order_flow = CASE
    WHEN order_flow IS NOT NULL AND order_flow <> 'legacy' THEN order_flow
    WHEN COALESCE(tenant_id, dealer_id) IS NOT NULL
      AND target_factory_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM tenants from_tenant
        WHERE from_tenant.id = COALESCE(orders.tenant_id, orders.dealer_id)
          AND from_tenant.tenant_type = 'dealer'
      )
      AND EXISTS (
        SELECT 1
        FROM tenants to_tenant
        WHERE to_tenant.id = orders.target_factory_id
          AND to_tenant.tenant_type = 'manufacturer'
      )
      THEN 'dealer_to_factory'
    WHEN COALESCE(tenant_id, dealer_id) IS NOT NULL
      AND target_factory_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM tenants from_tenant
        WHERE from_tenant.id = COALESCE(orders.tenant_id, orders.dealer_id)
          AND from_tenant.tenant_type = 'manufacturer'
      )
      AND EXISTS (
        SELECT 1
        FROM tenants to_tenant
        WHERE to_tenant.id = orders.target_factory_id
          AND to_tenant.tenant_type = 'material_supplier'
      )
      THEN 'factory_to_supplier'
    ELSE 'legacy'
  END
WHERE order_flow IS NULL
   OR order_flow = 'legacy'
   OR from_tenant_id IS NULL
   OR to_tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS orders_order_flow_idx ON orders(order_flow);
CREATE INDEX IF NOT EXISTS orders_from_tenant_id_idx ON orders(from_tenant_id);
CREATE INDEX IF NOT EXISTS orders_to_tenant_id_idx ON orders(to_tenant_id);
CREATE INDEX IF NOT EXISTS orders_parent_order_id_idx ON orders(parent_order_id);

CREATE TABLE IF NOT EXISTS order_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  module_no VARCHAR(80) NOT NULL,
  module_name VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  remark TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT order_modules_order_module_no_unique UNIQUE (order_id, module_no)
);

CREATE INDEX IF NOT EXISTS order_modules_order_id_idx ON order_modules(order_id);
CREATE INDEX IF NOT EXISTS order_modules_module_no_idx ON order_modules(module_no);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS module_id UUID;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_no VARCHAR(100);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS woodworking_craft TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS forming_craft TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS painting_craft TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS length_mm NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS width_mm NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS thickness_mm NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color VARCHAR(100);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS hardware VARCHAR(200);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS hardware_quantity NUMERIC(10, 2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS construction_surface VARCHAR(100);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_module_id_fkey'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_module_id_fkey
      FOREIGN KEY (module_id) REFERENCES order_modules(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS order_items_module_id_idx ON order_items(module_id);
CREATE INDEX IF NOT EXISTS order_items_item_no_idx ON order_items(item_no);

CREATE TABLE IF NOT EXISTS order_item_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  module_id UUID REFERENCES order_modules(id) ON DELETE SET NULL,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(120),
  file_size INTEGER,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_item_attachments_order_id_idx ON order_item_attachments(order_id);
CREATE INDEX IF NOT EXISTS order_item_attachments_module_id_idx ON order_item_attachments(module_id);
CREATE INDEX IF NOT EXISTS order_item_attachments_order_item_id_idx ON order_item_attachments(order_item_id);
CREATE INDEX IF NOT EXISTS order_item_attachments_tenant_id_idx ON order_item_attachments(tenant_id);

ALTER TABLE order_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_order_modules" ON order_modules;
CREATE POLICY "service_role_order_modules"
  ON order_modules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_order_item_attachments" ON order_item_attachments;
CREATE POLICY "service_role_order_item_attachments"
  ON order_item_attachments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
