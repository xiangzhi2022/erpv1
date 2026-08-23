import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { STANDARD_ROLE_PERMISSIONS } from '@/lib/enterprise/permissions';

describe('standard enterprise role permissions', () => {
  it('matches the role-permission matrix seeded by the tenancy migration', () => {
    const migrationPath = resolve(
      process.cwd(),
      'supabase/migrations/20260823090000_erp_tenancy_foundation.sql',
    );
    const migration = readFileSync(migrationPath, 'utf8');
    const matrix = migration.match(
      /-- BEGIN STANDARD_ROLE_PERMISSION_MATRIX([\s\S]*?)-- END STANDARD_ROLE_PERMISSION_MATRIX/,
    )?.[1];

    expect(matrix).toBeDefined();

    const sqlPairs = [...(matrix ?? '').matchAll(/\('([^']+)', '([^']+)'\)/g)]
      .map(([, role, permission]) => `${role}:${permission}`)
      .sort();
    const applicationPairs = Object.entries(STANDARD_ROLE_PERMISSIONS)
      .flatMap(([role, permissions]) =>
        permissions.map((permission) => `${role}:${permission}`),
      )
      .sort();

    expect(sqlPairs).toEqual(applicationPairs);
  });
});
