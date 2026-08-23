import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  root,
  'supabase/migrations/20260823160000_wage_mutation_return_boundary.sql',
);

describe('wage mutation return boundary', () => {
  it('returns only mutation acknowledgements and validates numeric inputs', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath)
      ? readFileSync(migrationPath, 'utf8')
      : '';

    for (const functionName of [
      'finance_settle_wage_records',
      'finance_pay_wage_record',
      'finance_manage_wage_record',
    ]) {
      const functionSource = migration.match(new RegExp(
        `create function public\\.${functionName}[\\s\\S]+?end;\\n\\$\\$;`,
        'i',
      ))?.[0] ?? '';
      expect(functionSource).toMatch(/returns table\s*\(\s*id uuid,\s*status text,\s*updated_at timestamptz\s*\)/i);
      expect(functionSource).not.toMatch(/returns setof public\.worker_wage_records/i);
      expect(functionSource).not.toMatch(/select \* from public\.worker_wage_records/i);
      expect(functionSource).toContain('has_enterprise_permission');
    }

    const manage = migration.match(
      /create function public\.finance_manage_wage_record[\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';
    expect(manage).toContain('INVALID_WAGE_NUMERIC_VALUE');
    expect(manage).toMatch(/target_wage_amount\s*<\s*0/);
    expect(manage).toMatch(/target_quantity\s*<\s*0/);
    expect(manage).toMatch(/target_unit_price\s*<\s*0/);
  });

  it('adds database coverage for no-read mutation callers and negative values', () => {
    const testPath = resolve(root, 'supabase/tests/wage_mutation_return_boundary.test.sql');
    expect(existsSync(testPath)).toBe(true);
    const databaseTest = existsSync(testPath) ? readFileSync(testPath, 'utf8') : '';
    expect(databaseTest).toContain('mutation-only wage manager receives no wage amount fields');
    expect(databaseTest).toContain('negative wage inputs are rejected before the update');
    expect(databaseTest).toContain("'INVALID_WAGE_NUMERIC_VALUE'");
  });
});
