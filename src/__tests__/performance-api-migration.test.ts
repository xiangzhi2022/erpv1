import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = [
  'src/app/api/performance/orders/route.ts',
  'src/app/api/performance/production/route.ts',
  'src/app/api/performance/workers/route.ts',
  'src/app/api/performance/workers/[id]/route.ts',
];

describe('performance API enterprise boundary', () => {
  it('uses the request-scoped client and an enterprise filter on every route', () => {
    for (const route of routes) {
      const source = readFileSync(resolve(process.cwd(), route), 'utf8');
      expect(source).not.toMatch(/getSupabaseClient|getUserFromRequest|@\/db\/client/);
      expect(source).toContain(".eq('enterprise_id', context.enterpriseId)");
      expect(source).not.toMatch(/\.select\(['"]\*['"]\)/);
    }
  });

  it('requires wage access before returning worker or labor-cost performance', () => {
    for (const route of [routes[0], routes[2], routes[3]]) {
      const source = readFileSync(resolve(process.cwd(), route), 'utf8');
      expect(source).toContain("requirePermission(context, 'wages.read.all')");
    }
  });
});
