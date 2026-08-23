import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  repositoryRoot,
  'supabase/migrations/20260823162000_finance_mutation_return_boundary.sql',
);

describe('finance mutation return boundary', () => {
  it('forward-replaces finance-only mutation RPCs with identifier-only acknowledgements', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    for (const functionName of [
      'finance_update_order_pricing',
      'finance_update_order_product',
      'finance_update_order_item_pricing',
      'update_order_internal_remark',
    ]) {
      const functionSource = migration.match(new RegExp(
        `create\\s+function\\s+public\\.${functionName}\\([\\s\\S]+?\\n\\$\\$;`,
        'i',
      ))?.[0] ?? '';

      expect(functionSource).toMatch(/returns\s+table\s*\(\s*id\s+uuid\s*\)/i);
      expect(functionSource).not.toMatch(/returns\s+setof\s+public\./i);
      expect(functionSource).not.toMatch(/returning\s+\*/i);
    }
    expect(migration.match(/::text in \('NaN', 'Infinity', '-Infinity'\)/g)).toHaveLength(9);
  });

  it('keeps the replacement RPCs private by default and callable only by authenticated users', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    for (const signature of [
      'finance_update_order_pricing(uuid, uuid, numeric, numeric, numeric, numeric)',
      'finance_update_order_product(uuid, uuid, numeric, numeric, numeric, text, boolean)',
      'finance_update_order_item_pricing(uuid, uuid, numeric, numeric)',
      'update_order_internal_remark(uuid, uuid, text)',
    ]) {
      const escaped = signature.replace(/[()]/g, '\\$&');
      expect(migration).toMatch(new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${escaped}\\s+from\\s+public,\\s*anon,\\s*authenticated,\\s*service_role`,
        'i',
      ));
      expect(migration).toMatch(new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${escaped}\\s+to\\s+authenticated`,
        'i',
      ));
    }
  });
});
