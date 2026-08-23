import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  repositoryRoot,
  'supabase/migrations/20260823152000_atomic_order_tree_save.sql',
);

describe('atomic order tree boundary', () => {
  it('ships one hardened transaction RPC for the complete tree', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    const functionSource = migration.match(
      /create function public\.save_order_tree\([\s\S]+?\n\$\$;/i,
    )?.[0] ?? '';

    expect(functionSource).toContain('security definer');
    expect(functionSource).toContain('set search_path = pg_catalog');
    expect(functionSource).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'orders.create')");
    expect(functionSource).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')");
    expect(functionSource).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage')");
    expect(functionSource).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'production.plan')");
    expect(functionSource).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'production.manage')");
    expect(functionSource).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'attachments.manage')");
    expect(functionSource).toContain('public.create_order_item_with_pricing(');
    expect(functionSource).toContain('app_private.create_order_product_with_pricing_internal(');
    expect(functionSource).toContain('public.create_production_tasks(');
    expect(functionSource).toContain("message = 'ORDER_TREE_NOT_EMPTY'");
    expect(functionSource).toContain("message = 'ORDER_ATTACHMENT_INPUT_INVALID'");
    expect(migration).toMatch(
      /alter function public\.save_order_tree\(uuid, uuid, jsonb\)\s+owner to v2_function_owner/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.save_order_tree\(uuid, uuid, jsonb\)[\s\S]+?from public, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.save_order_tree\(uuid, uuid, jsonb\)\s+to authenticated/i,
    );
  });

  it('keeps the application POST path to one RPC and no direct tree writes', () => {
    const route = readFileSync(resolve(repositoryRoot, 'src/app/api/orders/route.ts'), 'utf8');
    const postSource = route.slice(route.indexOf('export async function POST'));

    expect(postSource).toContain("rpc('save_order_tree'");
    expect(postSource.match(/\.rpc\(/g)).toHaveLength(1);
    expect(postSource).not.toContain('.from(');
    expect(postSource).not.toContain('.insert(');
    expect(postSource).not.toContain('.update(');
    expect(postSource).not.toContain('.delete(');
    expect(postSource).not.toContain('Promise.all(');
  });
});
