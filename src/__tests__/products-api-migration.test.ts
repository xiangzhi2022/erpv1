import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('order product API migration', () => {
  it('uses enterprise-scoped request clients without legacy user helpers', () => {
    for (const route of [
      'src/app/api/products/[id]/route.ts',
      'src/app/api/products/[id]/tasks/route.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), route), 'utf8');
      expect(source).not.toMatch(/getSupabaseClient|getUserFromRequest|@\/db\/client/);
      expect(source).toContain(".eq('enterprise_id', context.enterpriseId)");
    }
  });

  it('requires finance permission for product financial writes and validates task assignments', () => {
    const product = readFileSync(resolve(process.cwd(), 'src/app/api/products/[id]/route.ts'), 'utf8');
    const tasks = readFileSync(resolve(process.cwd(), 'src/app/api/products/[id]/tasks/route.ts'), 'utf8');
    expect(product).toContain("requirePermission(context, 'finance.manage')");
    expect(tasks).toContain("requirePermission(context, 'production.assign')");
    expect(tasks).toContain(".eq('status', 'active')");
  });

  it('keeps parent space and product status synchronization behind the guarded RPC', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/four-level-order-server.ts'), 'utf8');
    expect(source).toContain("supabase.rpc('transition_order_component_status'");
    expect(source).not.toContain(".update({ status: nextStatus");
  });

  it('creates and confirms production tasks only through guarded RPCs', () => {
    const productTasks = readFileSync(resolve(process.cwd(), 'src/app/api/products/[id]/tasks/route.ts'), 'utf8');
    const orderCreate = readFileSync(resolve(process.cwd(), 'src/app/api/orders/route.ts'), 'utf8');
    const atomicOrderMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260823152000_atomic_order_tree_save.sql'), 'utf8');
    const splitConfirm = readFileSync(resolve(process.cwd(), 'src/app/api/orders/[id]/split/confirm/route.ts'), 'utf8');

    expect(productTasks).toContain("rpc('create_production_tasks'");
    expect(productTasks).not.toContain("from('production_tasks').insert");
    expect(orderCreate).toContain("rpc('save_order_tree'");
    expect(atomicOrderMigration).toContain('public.create_production_tasks(');
    expect(orderCreate).not.toContain("from('production_tasks').insert");
    expect(splitConfirm).toContain("rpc('confirm_order_task_drafts'");
    expect(splitConfirm).not.toContain("from('production_tasks')\n      .update");
    expect(splitConfirm).not.toContain("rpc('transition_order_status'");
  });
});
