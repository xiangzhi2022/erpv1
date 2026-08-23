import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  repositoryRoot,
  'supabase/migrations/20260823145000_order_financial_write_boundary.sql',
);
const atomicStatusMigrationPath = resolve(
  repositoryRoot,
  'supabase/migrations/20260823153000_order_exchange_status_atomicity.sql',
);

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

describe('order financial write boundary', () => {
  it('ships a follow-up migration after the identity boundary', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('removes direct updates to every finance-sensitive order-detail column', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    for (const table of ['orders', 'order_products', 'order_items']) {
      expect(migration).toMatch(
        new RegExp(`revoke\\s+update\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+authenticated`, 'i'),
      );
    }
    for (const table of ['orders', 'order_products', 'order_items']) {
      expect(migration).toMatch(
        new RegExp(`revoke\\s+insert\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+authenticated`, 'i'),
      );
    }

    const orderGrant = migration.match(
      /grant\s+update\s*\(([^)]+)\)\s+on\s+table\s+public\.orders\s+to\s+authenticated/i,
    )?.[1] ?? '';
    expect(orderGrant).toContain('customer_name');
    expect(orderGrant).not.toMatch(/status|internal_remark|total_amount|cost_amount|profit_amount|deposit_amount/);
    const orderInsertGrant = migration.match(
      /grant\s+insert\s*\(([^)]+)\)\s+on\s+table\s+public\.orders\s+to\s+authenticated/i,
    )?.[1] ?? '';
    expect(orderInsertGrant).toContain('total_amount');
    expect(orderInsertGrant).not.toMatch(/status|internal_remark|cost_amount|profit_amount|deposit_amount/);

    const productGrant = migration.match(
      /grant\s+update\s*\(([^)]+)\)\s+on\s+table\s+public\.order_products\s+to\s+authenticated/i,
    )?.[1] ?? '';
    expect(productGrant).toContain('product_name');
    expect(productGrant).toContain('status');
    expect(productGrant).not.toMatch(/quoted_amount|cost_amount|profit_amount|internal_remark/);
    const productInsertGrant = migration.match(
      /grant\s+insert\s*\(([^)]+)\)\s+on\s+table\s+public\.order_products\s+to\s+authenticated/i,
    )?.[1] ?? '';
    expect(productInsertGrant).toContain('product_name');
    expect(productInsertGrant).not.toMatch(/status|quoted_amount|cost_amount|profit_amount|internal_remark/);

    const itemGrant = migration.match(
      /grant\s+update\s*\(([^)]+)\)\s+on\s+table\s+public\.order_items\s+to\s+authenticated/i,
    )?.[1] ?? '';
    expect(itemGrant).toContain('product_name');
    expect(itemGrant).not.toMatch(/unit_price|subtotal/);
    const itemInsertGrant = migration.match(
      /grant\s+insert\s*\(([^)]+)\)\s+on\s+table\s+public\.order_items\s+to\s+authenticated/i,
    )?.[1] ?? '';
    expect(itemInsertGrant).toContain('product_name');
    expect(itemInsertGrant).not.toMatch(/unit_price|subtotal/);
  });

  it('exposes only hardened RPCs for sensitive writes', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    for (const functionName of [
      'create_order_product_with_pricing',
      'create_order_item_with_pricing',
      'finance_update_order_product',
      'finance_update_order_item_pricing',
      'update_order_internal_remark',
      'transition_order_status',
    ]) {
      expect(migration).toContain(`create function public.${functionName}(`);
      expect(migration).toMatch(
        new RegExp(`alter function public\\.${functionName}\\([\\s\\S]+?owner to v2_function_owner`, 'i'),
      );
      expect(migration).toMatch(
        new RegExp(`revoke all on function public\\.${functionName}\\([\\s\\S]+?from public, anon, authenticated, service_role`, 'i'),
      );
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${functionName}\\([\\s\\S]+?to authenticated`, 'i'),
      );
    }

    expect(migration.match(/security definer/gi)).toHaveLength(6);
    expect(migration.match(/set search_path = pg_catalog/gi)).toHaveLength(7);
    expect(migration).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'finance.manage')");
    expect(migration).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'orders.update')");
    expect(migration).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'orders.accept')");
    expect(migration).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'production.plan')");
    expect(migration).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'production.manage')");
    expect(migration).toContain('ORDER_STATUS_TRANSITION_INVALID');
    expect(migration).toContain("target_expected_status = 'pending' and target_status in ('submitted', 'confirmed', 'accepted', 'returned', 'cancelled')");
    const statusFunction = migration.match(
      /create function public\.transition_order_status\([\s\S]+?\n\$\$;/i,
    )?.[0] ?? '';
    expect(statusFunction).toMatch(/returns\s+table\s*\(\s*id\s+uuid,\s*status\s+text,\s*updated_at\s+timestamptz\s*\)/i);
    expect(statusFunction).not.toContain('returns setof public.orders');
  });

  it('routes sensitive application writes through their RPCs', () => {
    const productRoute = source('src/app/api/products/[id]/route.ts');
    const detailRoute = source('src/app/api/orders/[id]/route.ts');
    const factoryRoute = source('src/app/api/factory/orders/route.ts');
    const splitRoute = source('src/app/api/orders/[id]/split/confirm/route.ts');
    const orderRoute = source('src/app/api/orders/route.ts');
    const basicOrderRoute = source('src/app/api/orders/basic/route.ts');
    const dealerCreateRoute = source('src/app/api/dealer/orders/create/route.ts');
    const spaceProductRoute = source('src/app/api/spaces/[id]/products/route.ts');
    const orderServer = source('src/lib/four-level-order-server.ts');

    expect(productRoute).toContain("rpc('finance_update_order_product'");
    expect(detailRoute).toContain("rpc('update_order_internal_remark'");
    expect(detailRoute).toContain("rpc('transition_order_status_with_exchanges'");
    expect(detailRoute).toContain("rpc('transition_order_exchanges_for_order'");
    expect(detailRoute).not.toContain("rpc('transition_order_exchange'");
    expect(factoryRoute).toContain("rpc('transition_order_status'");
    expect(splitRoute).toContain("rpc('confirm_order_task_drafts'");
    expect(splitRoute).not.toContain("rpc('transition_order_status'");
    expect(orderRoute).toContain("rpc('save_order_tree'");
    expect(orderRoute).not.toMatch(/rpc\(\s*'create_order_item_with_pricing'/);
    expect(orderRoute).not.toMatch(/rpc\(\s*'create_order_product_with_pricing'/);
    expect(dealerCreateRoute).toContain("rpc(\n      'create_dealer_order_with_items'");
    expect(dealerCreateRoute).not.toMatch(/\.from\(['"](?:orders|order_items)['"]\)/);
    expect(spaceProductRoute).toContain("rpc('create_order_product_with_pricing'");
    expect(basicOrderRoute).toContain("rpc('update_basic_order'");
    expect(basicOrderRoute).not.toContain("rpc('transition_order_status'");
    expect(orderServer).toContain("rpc('transition_order_status'");
  });

  it('ships atomic order-status and exchange-side-effect wrappers', () => {
    expect(existsSync(atomicStatusMigrationPath)).toBe(true);
    const migration = existsSync(atomicStatusMigrationPath)
      ? readFileSync(atomicStatusMigrationPath, 'utf8')
      : '';
    for (const functionName of [
      'transition_order_exchanges_for_order',
      'transition_order_status_with_exchanges',
    ]) {
      expect(migration).toContain(`create function public.${functionName}(`);
      expect(migration).toMatch(new RegExp(
        `alter function public\\.${functionName}\\([\\s\\S]+?owner to v2_function_owner`,
        'i',
      ));
      expect(migration).toMatch(new RegExp(
        `revoke all on function public\\.${functionName}\\([\\s\\S]+?from public, anon, authenticated, service_role`,
        'i',
      ));
    }
    expect(migration).toContain('from public.transition_order_status(');
    expect(migration).toContain('perform public.transition_order_exchange(');
  });
});
