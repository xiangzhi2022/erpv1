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
});
