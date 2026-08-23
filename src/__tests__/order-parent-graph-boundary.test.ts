import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(
  root,
  'supabase/migrations/20260823171000_order_parent_graph_boundary.sql',
);

describe('order parent graph boundary', () => {
  it('guards every order write with parent-flow and cycle invariants', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    const triggerFunction = migration.match(
      /create function app_private\.enforce_order_parent_graph[\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';

    expect(triggerFunction).toContain('NEW.parent_order_id = NEW.id');
    expect(triggerFunction).toContain("NEW.order_flow = 'factory_to_supplier'");
    expect(triggerFunction).toContain("parent_order.order_flow <> 'dealer_to_factory'");
    expect(triggerFunction).toContain('parent_order.to_enterprise_id is distinct from NEW.enterprise_id');
    expect(triggerFunction).toContain('ORDER_PARENT_CHILD_FLOW_INVALID');
    expect(triggerFunction).toContain('pg_advisory_xact_lock');
    expect(triggerFunction).toMatch(/with recursive ancestor[\s\S]+?ancestor\.id = NEW\.id/i);
    expect(migration).toMatch(
      /create trigger orders_parent_graph_guard[\s\S]+?before insert or update[\s\S]+?on public\.orders/i,
    );
  });

  it('adds database regressions for self, cycle, and wrong-flow parents', () => {
    const testPath = resolve(root, 'supabase/tests/order_parent_graph_boundary.test.sql');
    expect(existsSync(testPath)).toBe(true);
    const databaseTest = existsSync(testPath) ? readFileSync(testPath, 'utf8') : '';
    expect(databaseTest).toContain('an order cannot be its own parent');
    expect(databaseTest).toContain('an order parent update cannot create a cycle');
    expect(databaseTest).toContain('supplier-flow orders reject an unrelated parent flow');
    expect(databaseTest).toContain('a parent cannot be changed out from under a supplier-flow child');
  });
});
