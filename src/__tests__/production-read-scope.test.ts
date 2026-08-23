import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  repositoryRoot,
  'supabase/migrations/20260823163000_production_read_scope.sql',
);

function policy(source: string, name: string, table: string): string {
  return source.match(new RegExp(
    `create policy ${name} on public\\.${table}[\\s\\S]+?\\n\\);`,
    'i',
  ))?.[0] ?? '';
}

describe('production read workshop scope', () => {
  it('replaces generic production reads with explicit workshop and null-row rules', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    const workers = policy(migration, 'workers_select', 'workers');
    const workOrders = policy(migration, 'work_orders_select', 'work_orders');
    const progressLogs = policy(migration, 'progress_logs_select', 'progress_logs');

    for (const scopedPolicy of [workers, workOrders, progressLogs]) {
      expect(scopedPolicy).not.toContain('app_private.has_permission(');
      expect(scopedPolicy).toContain('app_private.has_enterprise_permission(');
      expect(scopedPolicy).toContain('app_private.can_access_workshop(');
    }
    expect(workOrders).toMatch(/work_orders\.workshop_id is null[\s\S]+?has_enterprise_permission/i);
    expect(workOrders).toMatch(/work_orders\.workshop_id is not null[\s\S]+?can_access_workshop/i);
    expect(progressLogs).toMatch(
      /from public\.work_orders work_order[\s\S]+?work_order\.enterprise_id = progress_logs\.enterprise_id[\s\S]+?work_order\.id = progress_logs\.work_order_id/i,
    );
  });

  it('preserves the authenticated worker self-read policy', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    const selfPolicy = policy(migration, 'workers_select_self', 'workers');

    expect(selfPolicy).toContain('workers.user_id = (select auth.uid())');
    expect(selfPolicy).toContain('app_private.is_active_member(workers.enterprise_id)');
  });

  it('ships two-workshop database isolation coverage', () => {
    const testPath = resolve(
      repositoryRoot,
      'supabase/tests/production_read_scope.test.sql',
    );
    expect(existsSync(testPath)).toBe(true);
    const databaseTest = existsSync(testPath) ? readFileSync(testPath, 'utf8') : '';

    for (const expectation of [
      'workshop A production reader sees only workshop A work orders',
      'workshop A production reader cannot see unassigned work orders',
      'workshop A production reader sees only workshop A progress logs',
      'workshop A production reader sees workshop A workers and their own worker binding',
      'workshop A production reader cannot see another workshop B worker',
    ]) {
      expect(databaseTest).toContain(expectation);
    }
  });
});
