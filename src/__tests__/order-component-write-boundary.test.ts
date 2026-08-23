import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(root, 'supabase/migrations/20260823166000_order_component_write_boundary.sql');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('order component write boundary', () => {
  it('removes direct structural writes and attachment mutations', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    for (const table of ['order_spaces', 'order_modules', 'order_items', 'order_products']) {
      expect(migration).toMatch(new RegExp(`revoke\\s+insert,\\s*update\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+authenticated`, 'i'));
      expect(migration).toMatch(new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+${table}_(?:insert|update)\\s+on\\s+public\\.${table}`, 'i'));
    }
    expect(migration).toMatch(/revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+public\.order_item_attachments\s+from\s+authenticated/i);
    for (const operation of ['insert', 'update', 'delete']) {
      expect(migration).toMatch(new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+order_item_attachments_${operation}\\s+on\\s+public\\.order_item_attachments`, 'i'));
    }
  });

  it('guards creation and base-field updates behind locked editable parent orders', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    for (const name of [
      'create_order_space',
      'create_order_product_with_pricing',
      'create_order_item_with_pricing',
      'update_order_component_fields',
    ]) {
      const qualifiedName = name === 'create_order_product_with_pricing'
        ? 'app_private\\.create_order_product_with_pricing_internal'
        : `public\\.${name}`;
      const body = migration.match(new RegExp(`create(?:\\s+or\\s+replace)?\\s+function\\s+${qualifiedName}\\([\\s\\S]+?\\n\\$\\$;`, 'i'))?.[0] ?? '';
      expect(body).toMatch(/from\s+public\.orders[\s\S]+?for\s+update/i);
      expect(body).toMatch(/status\s+not\s+in\s*\(\s*'draft',\s*'pending',\s*'returned',\s*'rejected'\s*\)/i);
      expect(body).toMatch(name === 'create_order_product_with_pricing'
        ? /security\s+invoker/i
        : /security\s+definer/i);
      expect(body).toMatch(/set\s+search_path\s*=\s*pg_catalog/i);
    }
    expect(migration).toContain('ORDER_PRODUCT_SPACE_NOT_FOUND');
    expect(migration).toContain('ORDER_ITEM_MODULE_NOT_FOUND');
    expect(migration).toMatch(/ORDER_ITEM_CREATE_FORBIDDEN[\s\S]+?orders\.update[\s\S]+?finance\.manage|orders\.update[\s\S]+?finance\.manage[\s\S]+?ORDER_ITEM_CREATE_FORBIDDEN/i);
    expect(migration).toContain('ORDER_PRODUCT_FINANCE_FORBIDDEN');
    expect(migration).toMatch(/component_status\s+not\s+in\s*\(\s*'draft',\s*'pending',\s*'returned',\s*'rejected'\s*\)/i);
    expect(migration).toMatch(/jsonb_typeof\(target_product\s*->\s*'quantity'\)[\s\S]+?quantity[^\n]+<=\s*0/i);
    expect(migration).toMatch(/jsonb_typeof\(target_item\s*->\s*'quantity'\)[\s\S]+?quantity[^\n]+<=\s*0/i);
    expect(migration).not.toMatch(/select\s+count\(\*\)::integer\s*\+\s*1\s+into\s+next_index/i);
    expect(migration).toMatch(/create\s+function\s+public\.create_order_product_with_pricing\([\s\S]+?returns\s+setof\s+public\.order_products/i);
    expect(migration).toMatch(/create\s+function\s+public\.create_order_item_with_pricing\([\s\S]+?returns\s+setof\s+public\.order_items/i);
    expect(migration).toMatch(/coalesce\(nullif\(target_product\s*->>\s*'status',[\s\S]+?'draft'\)\s*<>\s*'draft'/i);
    const atomicTree = source('supabase/migrations/20260823152000_atomic_order_tree_save.sql');
    expect(atomicTree).toContain('from app_private.create_order_product_with_pricing_internal(');
    expect(atomicTree).toContain('from public.create_order_item_with_pricing(');
    expect(migration).toMatch(/target_product\s+\?\|\s+array\['quoted_amount',\s*'cost_amount',\s*'profit_amount',\s*'internal_remark'\][\s\S]+?finance\.manage/i);
    expect(migration).toMatch(/revoke\s+all\s+on\s+function\s+app_private\.create_order_product_with_pricing_internal\(uuid,\s*uuid,\s*jsonb\)\s+from\s+public,\s*anon,\s*authenticated,\s*service_role/i);
    const databaseTypes = source('src/db/database.types.ts');
    expect(databaseTypes).toMatch(/create_order_product_with_pricing:[\s\S]+?Returns:\s*\{[\s\S]+?\}\[\][\s\S]+?SetofOptions:\s*\{[\s\S]+?to:\s*"order_products"[\s\S]+?isSetofReturn:\s*true/);
    expect(databaseTypes).toMatch(/create_order_item_with_pricing:[\s\S]+?Returns:\s*\{[\s\S]+?\}\[\][\s\S]+?SetofOptions:\s*\{[\s\S]+?to:\s*"order_items"[\s\S]+?isSetofReturn:\s*true/);
  });

  it('routes component creation and base updates only through guarded RPCs', () => {
    const spacePost = source('src/app/api/orders/[id]/spaces/route.ts');
    const productPost = source('src/app/api/spaces/[id]/products/route.ts');
    const spacePatch = source('src/app/api/spaces/[id]/route.ts');
    const productPatch = source('src/app/api/products/[id]/route.ts');

    expect(spacePost).toContain("rpc('create_order_space'");
    expect(spacePost).not.toMatch(/\.from\(['"]order_spaces['"]\)[\s\S]+?\.insert\(/);
    expect(productPost).toContain("rpc('create_order_product_with_pricing'");
    expect(productPost).not.toMatch(/\.from\(['"]order_products['"]\)[\s\S]+?\.insert\(/);
    for (const route of [spacePatch, productPatch]) {
      expect(route).toContain("rpc('update_order_component_fields'");
    }
    expect(spacePatch).not.toMatch(/\.from\(['"]order_spaces['"]\)[\s\S]+?\.update\(/);
    expect(productPatch).not.toMatch(/\.from\(['"]order_products['"]\)[\s\S]+?\.update\(/);
  });
});
