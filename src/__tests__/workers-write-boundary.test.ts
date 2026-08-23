import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  root,
  'supabase/migrations/20260823167000_workers_write_boundary.sql',
);

function source(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('workers write boundary', () => {
  it('uses column ACLs and workshop-aware members.manage policies', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    expect(migration).toMatch(
      /revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+public\.workers\s+from\s+authenticated/i,
    );
    expect(migration).toMatch(/grant\s+delete\s+on\s+table\s+public\.workers\s+to\s+authenticated/i);

    const insertGrant = migration.match(
      /grant\s+insert\s*\([\s\S]+?\)\s+on\s+table\s+public\.workers\s+to\s+authenticated/i,
    )?.[0] ?? '';
    const updateGrant = migration.match(
      /grant\s+update\s*\([\s\S]+?\)\s+on\s+table\s+public\.workers\s+to\s+authenticated/i,
    )?.[0] ?? '';

    for (const protectedColumn of ['id', 'user_id', 'created_by', 'created_at']) {
      expect(insertGrant).not.toMatch(new RegExp(`\\b${protectedColumn}\\b`, 'i'));
    }
    for (const protectedColumn of ['id', 'enterprise_id', 'user_id', 'created_by', 'created_at']) {
      expect(updateGrant).not.toMatch(new RegExp(`\\b${protectedColumn}\\b`, 'i'));
    }

    for (const policyName of ['workers_insert', 'workers_update', 'workers_delete']) {
      expect(migration).toContain(`drop policy if exists ${policyName} on public.workers`);
      expect(migration).toContain(`create policy ${policyName} on public.workers`);
    }
    expect(migration).toMatch(
      /workshop_id\s+is\s+null[\s\S]+?has_enterprise_permission\([\s\S]+?'members\.manage'/i,
    );
    expect(migration).toMatch(
      /workshop_id\s+is\s+not\s+null[\s\S]+?can_access_workshop\([\s\S]+?'members\.manage'[\s\S]+?workshop_id/i,
    );
    expect(migration.match(/app_private\.can_manage_worker_scope\(/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(migration).toContain('create function app_private.set_worker_created_by()');
    expect(migration).toMatch(/new\.created_by\s*:=\s*auth\.uid\(\)/i);
    expect(migration).toMatch(/before insert on public\.workers[\s\S]+?execute function app_private\.set_worker_created_by\(\)/i);
  });

  it('keeps worker routes and UI on the database status contract', () => {
    const collectionRoute = source('src/app/api/workers/route.ts');
    const itemRoute = source('src/app/api/workers/[id]/route.ts');
    const schemas = source('src/app/workers/schemas.ts');
    const statsRoute = source('src/app/api/workers/stats/route.ts');

    for (const route of [collectionRoute, itemRoute]) {
      expect(route).toContain("['active', 'inactive', 'departed']");
      expect(route).not.toContain("['active', 'on_leave', 'resigned']");
    }
    expect(collectionRoute).not.toMatch(/created_by:\s*user\.id/);
    expect(schemas).toContain("z.enum(['active', 'inactive', 'departed'])");
    expect(statsRoute).toContain("w.status === 'inactive'");
    expect(statsRoute).toContain("w.status === 'departed'");
  });

  it('ships database coverage for old/new workshop scope and identity ACLs', () => {
    const databaseTest = source('supabase/tests/workers_write_boundary.test.sql');

    for (const expectation of [
      'workshop A manager can insert a workshop A worker',
      'worker creation records the authenticated actor without accepting created_by input',
      'workshop A manager cannot insert a workshop B worker',
      'workshop A manager cannot move a worker to workshop B',
      'workshop A manager cannot update worker identity linkage',
      'workshop A manager cannot delete a workshop B worker',
      'enterprise manager can manage unassigned and workshop workers',
    ]) {
      expect(databaseTest).toContain(expectation);
    }
  });
});
