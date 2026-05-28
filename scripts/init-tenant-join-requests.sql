-- Tenant join request workflow for employee self-apply and organization invite.
-- Safe to run repeatedly against the existing Supabase PostgreSQL database.

CREATE TABLE IF NOT EXISTS tenant_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  request_type VARCHAR(30) NOT NULL CHECK (request_type IN ('employee_apply', 'org_invite')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
  role VARCHAR(50) NOT NULL DEFAULT 'employee',
  department VARCHAR(100),
  employee_no VARCHAR(40),
  message TEXT,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS tenant_join_requests_tenant_id_idx ON tenant_join_requests(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_join_requests_user_id_idx ON tenant_join_requests(user_id);
CREATE INDEX IF NOT EXISTS tenant_join_requests_phone_idx ON tenant_join_requests(phone);
CREATE INDEX IF NOT EXISTS tenant_join_requests_status_idx ON tenant_join_requests(status);
CREATE INDEX IF NOT EXISTS tenant_join_requests_type_idx ON tenant_join_requests(request_type);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_join_requests_pending_unique_idx
  ON tenant_join_requests(tenant_id, phone, request_type)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_unique_tenant_user_idx
  ON tenant_users(tenant_id, user_id);
