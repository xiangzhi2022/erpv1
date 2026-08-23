import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  repositoryRoot,
  'supabase/migrations/20260823156000_basic_order_atomic_update.sql',
);

describe('basic order atomic update boundary', () => {
  it('keeps basic fields unchanged when the pending-status transition fails', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    const functionSource = migration.match(
      /create function public\.update_basic_order\([\s\S]+?\n\$\$;/i,
    )?.[0] ?? '';

    expect(functionSource).toContain('security definer');
    expect(functionSource).toContain('set search_path = pg_catalog');
    expect(functionSource).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')");
    expect(functionSource).not.toContain("app_private.has_permission(target_enterprise_id, 'orders.update')");
    expect(functionSource).toMatch(/from public\.orders[\s\S]+for update/i);
    expect(functionSource).toContain('update public.orders');
    expect(functionSource).toContain('from public.transition_order_status(');
    expect(functionSource).not.toMatch(/exception\s+when/i);
    expect(migration).toMatch(
      /revoke all on function public\.update_basic_order\(uuid, uuid, jsonb\)[\s\S]+?from public, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.update_basic_order\(uuid, uuid, jsonb\)\s+to authenticated/i,
    );
  });

  it('uses exactly one RPC and no direct update for an existing basic order', () => {
    const route = readFileSync(
      resolve(repositoryRoot, 'src/app/api/orders/basic/route.ts'),
      'utf8',
    );
    const existingOrderPath = route.slice(
      route.indexOf('if (input.existing_order_id)'),
      route.indexOf("const { data, error } = await supabase.rpc('create_basic_order'"),
    );

    expect(existingOrderPath).toContain("rpc('update_basic_order'");
    expect(existingOrderPath.match(/\.rpc\(/g)).toHaveLength(1);
    expect(existingOrderPath).not.toContain('.update(');
    expect(existingOrderPath).not.toContain("rpc('transition_order_status'");
  });

  it('covers database rollback when the status transition rejects the update', () => {
    const databaseTestPath = resolve(
      repositoryRoot,
      'supabase/tests/basic_order_atomic_update.test.sql',
    );
    expect(existsSync(databaseTestPath)).toBe(true);
    const databaseTest = existsSync(databaseTestPath)
      ? readFileSync(databaseTestPath, 'utf8')
      : '';

    expect(databaseTest).toContain("'ORDER_STATUS_TRANSITION_INVALID'");
    expect(databaseTest).toContain("'basic fields roll back when the status transition fails'");
    expect(databaseTest).toContain("'workshop-scoped orders.update cannot mutate enterprise-wide basic order fields'");
  });
});
