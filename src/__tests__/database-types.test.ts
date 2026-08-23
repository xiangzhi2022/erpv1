import { getTableColumns, getTableName } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { EnterpriseContextRef, EnterpriseId } from '@/db/enterprise-types';

describe('Supabase v2 Drizzle schema', () => {
  it('models the canonical enterprise and membership tables', async () => {
    const schema = await import('@/db/v2-schema');

    expect(getTableName(schema.enterprises)).toBe('enterprises');
    expect(getTableName(schema.enterpriseMemberships)).toBe(
      'enterprise_memberships',
    );
    expect(getTableColumns(schema.enterpriseMemberships).tenantId.name).toBe(
      'tenant_id',
    );
    expect(getTableColumns(schema.enterpriseMemberships).userId.name).toBe(
      'user_id',
    );
  });

  it('models canonical RBAC, idempotency, and audit columns', async () => {
    const schema = await import('@/db/v2-schema');

    expect(getTableName(schema.permissionCatalog)).toBe('permission_catalog');
    expect(getTableName(schema.roles)).toBe('roles');
    expect(getTableName(schema.rolePermissions)).toBe('role_permissions');
    expect(getTableName(schema.apiIdempotencyKeys)).toBe(
      'api_idempotency_keys',
    );
    expect(getTableName(schema.auditEvents)).toBe('audit_events');
    expect(getTableColumns(schema.roles).isSystem.name).toBe('is_system');
    expect(getTableColumns(schema.rolePermissions).permissionCode.name).toBe(
      'permission_code',
    );
    expect(getTableColumns(schema.apiIdempotencyKeys).claimToken.name).toBe(
      'claim_token',
    );
  });

  it('brands enterprise identifiers instead of accepting arbitrary strings', () => {
    expectTypeOf<EnterpriseId>().toMatchTypeOf<string>();
    expectTypeOf<string>().not.toMatchTypeOf<EnterpriseId>();
    expectTypeOf<EnterpriseContextRef['enterpriseId']>().toEqualTypeOf<EnterpriseId>();
  });

  it('exports only migrated application tables and no legacy password tables', async () => {
    const schema = await import('@/db/schema');
    const erpTableNames = [
      'profiles',
      'customers',
      'orders',
      'productionTasks',
      'workOrders',
      'tasks',
    ] as const;

    for (const tableName of erpTableNames) {
      const columns = getTableColumns(schema[tableName]);
      expect(columns.enterprise_id?.name).toBe('enterprise_id');
      expect(columns).not.toHaveProperty('password');
    }

    expect(schema).not.toHaveProperty('users');
    expect(schema).not.toHaveProperty('tenants');
    expect(schema).not.toHaveProperty('permissions');
  });
});
