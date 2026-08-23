import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  repositoryRoot,
  'supabase/migrations/20260823161000_order_relation_write_boundary.sql',
);

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

describe('order relation write boundary', () => {
  it('removes direct order creation and limits updates to non-relational base fields', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    expect(migration).toMatch(
      /revoke\s+insert\s+on\s+table\s+public\.orders\s+from\s+authenticated/i,
    );
    const insertRevoke = migration.match(
      /revoke\s+insert\s*\(([^)]+)\)\s+on\s+table\s+public\.orders\s+from\s+authenticated/i,
    )?.[1] ?? '';
    for (const formerlyGrantedColumn of [
      'enterprise_id',
      'order_no',
      'total_amount',
      'target_factory_id',
      'dealer_id',
      'order_flow',
      'from_enterprise_id',
      'to_enterprise_id',
      'parent_order_id',
      'created_by',
    ]) {
      expect(insertRevoke).toContain(formerlyGrantedColumn);
    }
    expect(migration).not.toMatch(
      /grant\s+insert\s*\([^)]+\)\s+on\s+table\s+public\.orders\s+to\s+authenticated/i,
    );
    expect(migration).toMatch(
      /revoke\s+update\s+on\s+table\s+public\.orders\s+from\s+authenticated/i,
    );
    const updateRevoke = migration.match(
      /revoke\s+update\s*\(([^)]+)\)\s+on\s+table\s+public\.orders\s+from\s+authenticated/i,
    )?.[1] ?? '';
    for (const guardedColumn of [
      'order_no',
      'target_factory_id',
      'dealer_id',
      'order_flow',
      'from_enterprise_id',
      'to_enterprise_id',
      'parent_order_id',
    ]) {
      expect(updateRevoke).toContain(guardedColumn);
    }

    const updateGrant = migration.match(
      /grant\s+update\s*\(([^)]+)\)\s+on\s+table\s+public\.orders\s+to\s+authenticated/i,
    )?.[1] ?? '';
    for (const safeColumn of [
      'customer_name',
      'customer_phone',
      'customer_address',
      'order_source',
      'delivery_date',
      'remark',
      'updated_at',
    ]) {
      expect(updateGrant).toContain(safeColumn);
    }
    for (const guardedColumn of [
      'enterprise_id',
      'order_no',
      'status',
      'total_amount',
      'target_factory_id',
      'dealer_id',
      'order_flow',
      'from_enterprise_id',
      'to_enterprise_id',
      'parent_order_id',
      'created_by',
    ]) {
      expect(updateGrant).not.toContain(guardedColumn);
    }

    expect(migration).toMatch(
      /create policy orders_update[\s\S]+?app_private\.has_enterprise_permission\(orders\.enterprise_id, 'orders\.update'\)/i,
    );
    expect(migration).toMatch(
      /revoke\s+delete\s+on\s+table\s+public\.orders\s+from\s+authenticated/i,
    );
    expect(migration).toMatch(/drop policy if exists orders_delete on public\.orders/i);
    expect(migration).not.toMatch(/create policy orders_delete/i);
  });

  it('creates basic orders only through a guarded enterprise-scoped RPC', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    const functionSource = migration.match(
      /create function public\.create_basic_order\([\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';

    expect(functionSource).toContain('security definer');
    expect(functionSource).toContain('set search_path = pg_catalog');
    expect(functionSource).toContain(
      "app_private.has_enterprise_permission(target_enterprise_id, 'orders.create')",
    );
    expect(functionSource).toContain('ORDER_BASIC_FLOW_FORBIDDEN');
    expect(functionSource).toContain('PARENT_ORDER_NOT_FOUND');
    expect(functionSource).toContain('ORDER_NUMBER_CONFLICT');
    expect(functionSource).toMatch(/insert into public\.orders/i);
    expect(migration).toMatch(
      /revoke all on function public\.create_basic_order\(uuid, jsonb\)[\s\S]+?from public, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.create_basic_order\(uuid, jsonb\)\s+to authenticated/i,
    );
  });

  it('routes basic creation through the RPC and does not accept relation fields in detail PATCH', () => {
    const basicRoute = source('src/app/api/orders/basic/route.ts');
    const createPath = basicRoute.slice(basicRoute.indexOf('if (input.existing_order_id)'));
    expect(createPath).toContain("rpc('create_basic_order'");
    expect(createPath).not.toMatch(/\.from\(['"]orders['"]\)\.insert\(/);

    const detailRoute = source('src/app/api/orders/[id]/route.ts');
    const patchSchema = detailRoute.match(
      /const patchOrderSchema = z\.object\(\{[\s\S]+?\}\)\.strict\(\)/,
    )?.[0] ?? '';
    for (const relationField of [
      'target_factory_id',
      'to_enterprise_id',
      'parent_order_id',
    ]) {
      expect(patchSchema).not.toContain(relationField);
    }
  });

  it('ships database coverage for privileges, scope, flow, parents, and uniqueness', () => {
    const databaseTestPath = resolve(
      repositoryRoot,
      'supabase/tests/order_relation_write_boundary.test.sql',
    );
    expect(existsSync(databaseTestPath)).toBe(true);
    const databaseTest = existsSync(databaseTestPath)
      ? readFileSync(databaseTestPath, 'utf8')
      : '';

    for (const expectation of [
      'authenticated callers cannot directly insert orders',
      'authenticated callers cannot directly update order relationship fields',
      'workshop-scoped orders.create cannot create enterprise-wide basic orders',
      'enterprise type fixes the basic-order flow',
      'basic-order parents cannot cross enterprise boundaries',
      'basic-order numbers remain unique inside an enterprise',
    ]) {
      expect(databaseTest).toContain(expectation);
    }
  });
});
