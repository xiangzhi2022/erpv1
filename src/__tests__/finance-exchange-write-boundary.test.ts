import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  repositoryRoot,
  'supabase/migrations/20260823113000_finance_exchange_write_boundary.sql',
);

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

describe('finance and exchange database write boundary', () => {
  it('ships a follow-up migration for the direct-write regressions', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('removes authenticated table-wide updates from finance-sensitive rows', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    expect(migration).toMatch(/revoke\s+update\s+on\s+table\s+public\.orders\s+from\s+authenticated/i);
    expect(migration).toMatch(/revoke\s+update\s+on\s+table\s+public\.worker_wage_records\s+from\s+authenticated/i);
    expect(migration).toContain('worker_wage_records_update_pending');
    expect(migration).toMatch(/status\s*=\s*'pending'/);

    const orderGrant = migration.match(
      /grant\s+update\s*\(([^)]+)\)\s+on\s+table\s+public\.orders\s+to\s+authenticated/i,
    )?.[1] ?? '';
    expect(orderGrant).toContain('customer_name');
    expect(orderGrant).not.toMatch(/total_amount|cost_amount|profit_amount|deposit_amount/);

    const wageGrant = migration.match(
      /grant\s+update\s*\(([^)]+)\)\s+on\s+table\s+public\.worker_wage_records\s+to\s+authenticated/i,
    )?.[1] ?? '';
    expect(wageGrant).toContain('wage_amount');
    expect(wageGrant).not.toMatch(/status|approved_by|approved_at|paid_at/);
  });

  it('makes restricted RPCs the only order-exchange write surface', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    for (const policy of [
      'order_exchanges_insert',
      'order_exchanges_update',
      'order_exchanges_delete',
      'order_exchanges_participant_insert',
      'order_exchanges_participant_update',
    ]) {
      expect(migration).toContain(`drop policy if exists ${policy} on public.order_exchanges`);
    }
    expect(migration).toMatch(
      /revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+public\.order_exchanges\s+from\s+authenticated/i,
    );
    expect(migration).toContain('create function public.create_order_exchange(');
    expect(migration).toContain('create function public.transition_order_exchange(');
    expect(migration).toContain("not app_private.has_permission(target_from_enterprise_id, 'orders.submit')");
    expect(migration).toContain("not app_private.has_permission(existing_exchange.to_enterprise_id, 'orders.accept')");
  });

  it('keeps every supported and legacy-valid exchange status in the database constraint', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    const constraint = migration.match(
      /add constraint order_exchanges_status_check[\s\S]+?check\s*\(status\s+in\s*\(([^)]+)\)\)/i,
    )?.[1] ?? '';

    for (const status of [
      'draft',
      'sent',
      'change_requested',
      'accepted',
      'completed',
      'returned',
      'rejected',
      'withdrawn',
    ]) {
      expect(constraint).toContain(`'${status}'`);
    }
    expect(source('src/lib/order-exchange.ts')).toContain("| 'returned'");
  });

  it('routes order-exchange writes through the restricted RPCs', () => {
    const collectionRoute = source('src/app/api/order-exchanges/route.ts');
    const itemRoute = source('src/app/api/order-exchanges/[id]/route.ts');
    const orderDetailRoute = source('src/app/api/orders/[id]/route.ts');

    expect(collectionRoute).toContain("rpc('create_order_exchange'");
    expect(itemRoute).toContain("rpc('transition_order_exchange'");
    expect(collectionRoute).not.toMatch(
      /\.from\('order_exchanges'\)[\s\S]{0,160}\.(?:insert|update)\(/,
    );
    expect(itemRoute).not.toMatch(
      /\.from\('order_exchanges'\)[\s\S]{0,160}\.(?:insert|update)\(/,
    );
    expect(orderDetailRoute).toContain("rpc('transition_order_exchange'");
    expect(orderDetailRoute).not.toMatch(
      /\.from\('order_exchanges'\)[\s\S]{0,260}\.update\(/,
    );
  });

  it('keeps order update APIs compatible with the finance column boundary', () => {
    const orderDetailRoute = source('src/app/api/orders/[id]/route.ts');
    const orderTreeRoute = source('src/app/api/orders/route.ts');
    const basicOrderRoute = source('src/app/api/orders/basic/route.ts');

    expect(orderDetailRoute).toContain("rpc('finance_update_order_pricing'");
    expect(orderTreeRoute).toContain("rpc('finance_update_order_pricing'");
    expect(orderTreeRoute).toContain('nonFinancialOrderPayload');
    expect(basicOrderRoute).toContain('basicOrderUpdatePayload');
  });
});
