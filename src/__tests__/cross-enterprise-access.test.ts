import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { orderFormSchema } from '@/app/orders/schemas';
import { categoryCreateSchema } from '@/lib/categories/service';
import {
  resolveEnterpriseContext,
  type EnterpriseContextDependencies,
  type EnterpriseMembershipRecord,
} from '@/lib/enterprise/context';
import { taskCreateSchema } from '@/lib/tasks/schemas';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const enterpriseA = '10000000-0000-4000-8000-000000000001';
const enterpriseB = '20000000-0000-4000-8000-000000000002';

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function membership(userId: string, tenantId: string): EnterpriseMembershipRecord {
  return {
    id: `${userId}-membership`,
    tenantId,
    userId,
    displayName: userId,
    status: 'active',
    enterpriseName: tenantId,
    enterpriseType: 'manufacturer',
    enterpriseStatus: 'active',
  };
}

function contextDependencies(
  userId: string,
  ownMembership: EnterpriseMembershipRecord,
): EnterpriseContextDependencies {
  return {
    getVerifiedUserId: vi.fn(async () => userId),
    listMemberships: vi.fn(async () => [ownMembership]),
    authorizeSelection: vi.fn(async (requestedId) => ({
      allowed: requestedId === ownMembership.tenantId,
      membershipId: requestedId === ownMembership.tenantId ? ownMembership.id : null,
      tenantId: requestedId === ownMembership.tenantId ? ownMembership.tenantId : null,
    })),
    listGrants: vi.fn(async () => []),
  };
}

describe('cross-enterprise access boundary', () => {
  it('keeps two authenticated users in their own enterprise and rejects a forged selector', async () => {
    const userA = contextDependencies('user-a', membership('user-a', enterpriseA));
    const userB = contextDependencies('user-b', membership('user-b', enterpriseB));

    await expect(resolveEnterpriseContext(userA)).resolves.toMatchObject({ enterpriseId: enterpriseA });
    await expect(resolveEnterpriseContext(userB)).resolves.toMatchObject({ enterpriseId: enterpriseB });
    await expect(resolveEnterpriseContext(userA, { requestedEnterpriseId: enterpriseB }))
      .rejects.toMatchObject({ code: 'ENTERPRISE_ACCESS_FORBIDDEN', status: 403 });
  });

  it('derives enterprise ownership server-side instead of accepting forged mutation fields', () => {
    expect(categoryCreateSchema.safeParse({ name: '跨企业分类', enterprise_id: enterpriseB }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: '跨企业任务', enterprise_id: enterpriseB }).success).toBe(false);

    const parsedOrder = orderFormSchema.parse({
      order_no: 'ORDER-1',
      order_flow: 'dealer_to_factory',
      customer_name: '订单',
      modules: [{
        module_name: '主卧',
        items: [{ product_name: '衣柜', quantity: 1, unit: '件', unit_price: 0, tasks: [] }],
      }],
      enterprise_id: enterpriseB,
    });
    expect(parsedOrder).not.toHaveProperty('enterprise_id');

    const basicOrderRoute = source('src/app/api/orders/basic/route.ts');
    expect(basicOrderRoute).toMatch(/enterprise_id:\s*context\.enterpriseId/);
    expect(basicOrderRoute).toMatch(/\.eq\('enterprise_id',\s*context\.enterpriseId\)/);
  });

  it('scopes direct-ID and list access to the authoritative enterprise', () => {
    for (const path of [
      'src/app/api/orders/[id]/route.ts',
      'src/app/api/products/[id]/route.ts',
      'src/app/api/spaces/[id]/route.ts',
      'src/app/api/orders/route.ts',
      'src/app/actions/tasks.ts',
    ]) {
      const route = source(path);
      expect(route, path).toContain('getEnterpriseContext');
      expect(route, path).toContain('context.enterpriseId');
    }

    const workerRoute = source('src/app/api/workers/[id]/route.ts');
    const scopedWorkerQueries = workerRoute.match(
      /\.eq\('enterprise_id',\s*user\.enterpriseId\)\.eq\('id',\s*id\)/g,
    ) ?? [];
    expect(scopedWorkerQueries).toHaveLength(5);

    const rlsTest = source('supabase/tests/erp_tenancy_rls.test.sql');
    expect(rlsTest).toContain('enterprise A cannot select enterprise B customers');
    expect(rlsTest).toContain('enterprise A cannot insert enterprise B customers');
    expect(rlsTest).toContain('enterprise A cannot update enterprise B customers');
    expect(rlsTest).toContain('enterprise A cannot delete enterprise B customers');
  });

  it('keeps worker endpoints self-only and partner directory DTOs redacted', () => {
    const workerTasksRoute = source('src/app/api/worker/me/tasks/route.ts');
    expect(workerTasksRoute).toMatch(/\.eq\('enterprise_id',\s*context\.enterpriseId\)\.eq\('user_id',\s*context\.userId\)/);
    expect(workerTasksRoute).toMatch(/assigned_worker_id\.eq\.\$\{worker\.id\},worker_id\.eq\.\$\{worker\.id\}/);

    const partnerDirectoryRoute = source('src/app/api/enterprise-directory/route.ts');
    expect(partnerDirectoryRoute).toContain("select('id,name,code,enterprise_type,status,created_at,updated_at'");
    expect(partnerDirectoryRoute).toMatch(/contact_person:\s*null/);
    expect(partnerDirectoryRoute).toMatch(/contact_phone:\s*null/);
    expect(partnerDirectoryRoute).toMatch(/address:\s*null/);
  });

  it('sets an enterprise cookie only after an authoritative database authorization', () => {
    const organizationsRoute = source('src/app/api/organizations/route.ts');
    const authorization = organizationsRoute.indexOf("rpc('authorize_enterprise_selection'");
    const cookieWrite = organizationsRoute.indexOf('response.cookies.set');

    expect(authorization).toBeGreaterThanOrEqual(0);
    expect(cookieWrite).toBeGreaterThan(authorization);
    expect(organizationsRoute).toMatch(/if\s*\(error\s*\|\|\s*!selection\?\.allowed[\s\S]*ENTERPRISE_ACCESS_FORBIDDEN/);
  });
});
