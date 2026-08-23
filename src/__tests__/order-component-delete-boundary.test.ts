import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  repositoryRoot,
  'supabase/migrations/20260823164000_order_component_delete_boundary.sql',
);

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

describe('order component delete boundary', () => {
  it('removes direct component deletion and exposes one guarded RPC', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    for (const table of ['order_spaces', 'order_modules', 'order_items', 'order_products']) {
      expect(migration).toMatch(new RegExp(
        `revoke\\s+delete\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+authenticated`,
        'i',
      ));
      expect(migration).toMatch(new RegExp(
        `drop\\s+policy\\s+if\\s+exists\\s+${table}_delete\\s+on\\s+public\\.${table}`,
        'i',
      ));
    }

    expect(migration).toContain('create function public.delete_order_component(');
    expect(migration).toMatch(/security\s+definer/i);
    expect(migration).toMatch(/set\s+search_path\s*=\s*pg_catalog/i);
    expect(migration).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')");
    expect(migration).toMatch(/order_status\s+not\s+in\s*\(\s*'draft',\s*'pending',\s*'returned',\s*'rejected'\s*\)/i);
    expect(migration).toMatch(/component_status\s+not\s+in\s*\(\s*'draft',\s*'pending',\s*'returned',\s*'rejected'\s*\)/i);
    expect(migration).toMatch(/from\s+public\.order_products\s+descendant[\s\S]+?descendant\.status\s+not\s+in/i);
    expect(migration).toMatch(/from\s+public\.orders[\s\S]+?for\s+update/i);
    expect(migration).toMatch(/insert\s+into\s+public\.order_status_logs/i);
    expect(migration).toMatch(/revoke\s+all\s+on\s+function\s+public\.delete_order_component\(uuid,\s*text,\s*uuid\)[\s\S]+?from\s+public,\s*anon,\s*authenticated,\s*service_role/i);
    expect(migration).toMatch(/grant\s+execute\s+on\s+function\s+public\.delete_order_component\(uuid,\s*text,\s*uuid\)\s+to\s+authenticated/i);
  });

  it('routes space and product deletion through the guarded RPC', () => {
    for (const [path, targetType] of [
      ['src/app/api/spaces/[id]/route.ts', 'space'],
      ['src/app/api/products/[id]/route.ts', 'product'],
    ] as const) {
      const route = source(path);
      const deleteHandler = route.slice(route.indexOf('export async function DELETE'));

      expect(deleteHandler).toContain("rpc('delete_order_component'");
      expect(deleteHandler).toContain(`target_type: '${targetType}'`);
      expect(deleteHandler).not.toContain('.delete()');
    }
  });
});
