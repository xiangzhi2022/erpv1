import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  import.meta.dirname,
  '../../supabase/migrations/20260823159000_order_exchange_invariants.sql',
);

function migrationSource(): string {
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
}

describe('order exchange invariants forward migration', () => {
  it('locks the source order and only sends pending orders to their bound recipient', () => {
    const migration = migrationSource();
    const createExchange = migration.match(
      /create or replace function public\.create_order_exchange[\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';

    expect(createExchange).toMatch(
      /from public\.orders order_row[\s\S]+?where order_row\.enterprise_id = target_from_enterprise_id[\s\S]+?and order_row\.id = target_order_id[\s\S]+?for update/i,
    );
    expect(createExchange).toContain("source_order.status <> 'pending'");
    expect(createExchange).toContain("source_order.order_flow = 'dealer_to_factory'");
    expect(createExchange).toContain(
      'source_order.to_enterprise_id is distinct from target_to_enterprise_id',
    );
    expect(createExchange).toContain(
      'source_order.target_factory_id is distinct from target_to_enterprise_id',
    );
    expect(createExchange).toContain("source_order.order_flow = 'factory_to_supplier'");
    expect(createExchange).toContain(
      'source_order.target_factory_id is distinct from target_from_enterprise_id',
    );
    expect(createExchange).toContain('source_order.order_flow is null');
    expect(createExchange).toContain(
      "source_order.order_flow not in ('dealer_to_factory', 'factory_to_supplier')",
    );
    expect(createExchange).not.toMatch(/or\s+case[\s\S]+?end\s+then/i);
  });

  it('rejects a second active exchange while holding the order lock', () => {
    const migration = migrationSource();
    const createExchange = migration.match(
      /create or replace function public\.create_order_exchange[\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';

    expect(createExchange).toMatch(
      /from public\.order_exchanges existing_exchange[\s\S]+?existing_exchange\.status in \('draft', 'sent', 'change_requested', 'accepted'\)/i,
    );
    expect(createExchange).toContain('ORDER_EXCHANGE_ACTIVE_EXISTS');
  });

  it('does not pretend a receiver-owned order can share the sender exchange order id', () => {
    const migration = migrationSource();
    const statusWrapper = migration.match(
      /create or replace function public\.transition_order_status_with_exchanges[\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';
    expect(statusWrapper).not.toContain("target_status in ('accepted', 'reviewed')");
    expect(statusWrapper).toContain("if target_status = 'cancelled' then");
    expect(statusWrapper).toContain('exchange.enterprise_id = target_enterprise_id');
  });
});
