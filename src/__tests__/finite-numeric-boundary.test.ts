import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  root,
  'supabase/migrations/20260823169000_finite_numeric_boundary.sql',
);
const validationMigrationPath = resolve(
  root,
  'supabase/migrations/20260823170000_validate_finite_numeric_boundary.sql',
);

describe('finite numeric boundary', () => {
  it('adds finite-value constraints without holding validation scans under DDL locks', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    for (const table of [
      'employees',
      'orders',
      'order_items',
      'order_products',
      'production_tasks',
      'worker_wage_records',
      'wage_rules',
      'work_orders',
      'progress_logs',
    ]) {
      expect(migration).toContain(`'${table}'`);
    }
    expect(migration).toContain("not in (''NaN'', ''Infinity'', ''-Infinity'')");
    expect(migration).toMatch(/add constraint[\s\S]+?not valid/i);
    expect(migration).not.toMatch(/validate constraint/i);

    expect(existsSync(validationMigrationPath)).toBe(true);
    const validationMigration = existsSync(validationMigrationPath)
      ? readFileSync(validationMigrationPath, 'utf8')
      : '';
    expect(validationMigration).toMatch(/validate constraint/i);
  });

  it('covers the JSON mutation paths with catalog-level pgTAP assertions', () => {
    const testPath = resolve(root, 'supabase/tests/finite_numeric_boundary.test.sql');
    expect(existsSync(testPath)).toBe(true);
    const databaseTest = existsSync(testPath) ? readFileSync(testPath, 'utf8') : '';
    for (const column of [
      'employees.base_salary',
      'orders.total_amount',
      'order_items.quantity',
      'order_items.unit_price',
      'order_products.quoted_amount',
      'production_tasks.estimated_wage_amount',
    ]) {
      expect(databaseTest).toContain(column);
    }
    expect(databaseTest).toContain('non-finite values are rejected at the storage boundary');
  });
});
