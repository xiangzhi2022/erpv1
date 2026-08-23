import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  root,
  'supabase/migrations/20260823165000_order_exchange_mutation_return_boundary.sql',
);

describe('order exchange mutation return boundary', () => {
  it('returns only an acknowledgement from the transition RPC', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    const functionSource = migration.match(
      /create function public\.transition_order_exchange[\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';

    expect(functionSource).toMatch(
      /returns table\s*\(\s*id uuid,\s*status text,\s*updated_at timestamptz\s*\)/i,
    );
    expect(functionSource).not.toMatch(/returns setof public\.order_exchanges/i);
    expect(functionSource).not.toMatch(/returning \*/i);
    expect(functionSource).not.toMatch(/return next updated_exchange/i);
  });

  it('keeps generated types and the API response on the minimal return shape', () => {
    const databaseTypes = readFileSync(resolve(root, 'src/db/database.types.ts'), 'utf8');
    const transitionType = databaseTypes.match(
      /transition_order_exchange: \{[\s\S]+?\n\s{6}\}/,
    )?.[0] ?? '';
    const route = readFileSync(
      resolve(root, 'src/app/api/order-exchanges/[id]/route.ts'),
      'utf8',
    );

    expect(transitionType).toContain('Returns: { id: string; status: string; updated_at: string }[]');
    expect(transitionType).not.toContain('Tables"]["order_exchanges"]["Row"]');
    expect(route).toContain('return NextResponse.json({ success: true, exchange });');
  });
});
