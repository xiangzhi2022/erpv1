import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  root,
  'supabase/migrations/20260823168000_join_request_notification_scope.sql',
);

describe('join request and notification scope', () => {
  it('limits enterprise join-request reads to the applicant or enterprise managers', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    const policy = migration.match(
      /create policy enterprise_join_requests_select[\s\S]+?;\n/i,
    )?.[0] ?? '';

    expect(migration).toMatch(
      /drop policy if exists enterprise_join_requests_select\s+on public\.enterprise_join_requests/i,
    );
    expect(migration).toMatch(
      /drop policy if exists enterprise_join_requests_select_own\s+on public\.enterprise_join_requests/i,
    );
    expect(policy).toContain('user_id = (select auth.uid())');
    expect(policy).toContain(
      "app_private.has_enterprise_permission(enterprise_id, 'members.manage')",
    );
    expect(policy).not.toContain('app_private.has_permission(');
  });

  it('removes the unused direct notification delete path', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    expect(migration).toContain('drop policy if exists notifications_delete on public.notifications');
    expect(migration).toMatch(
      /revoke\s+delete\s+on\s+table\s+public\.notifications\s+from\s+authenticated/i,
    );
  });

  it('ships catalog-level pgTAP coverage for both boundaries', () => {
    const testPath = resolve(root, 'supabase/tests/join_request_notification_scope.test.sql');
    expect(existsSync(testPath)).toBe(true);
    const databaseTest = existsSync(testPath) ? readFileSync(testPath, 'utf8') : '';
    expect(databaseTest).toContain('join request enterprise reads require enterprise members.manage');
    expect(databaseTest).toContain('authenticated users cannot directly delete notifications');
  });
});
