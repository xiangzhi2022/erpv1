import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getEnterpriseContext: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  requirePermission: mocks.requirePermission,
}));

interface QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

function createCategoryClient(result: QueryResult) {
  const calls: Array<readonly [string, unknown]> = [];
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      calls.push([column, value]);
      return query;
    }),
    order: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn((value: unknown) => {
      calls.push(['insert', value]);
      return query;
    }),
    update: vi.fn((value: unknown) => {
      calls.push(['update', value]);
      return query;
    }),
    delete: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return {
    calls,
    from: vi.fn(() => query),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEnterpriseContext.mockResolvedValue({
    enterpriseId: ENTERPRISE_ID,
    userId: '33333333-3333-4333-8333-333333333333',
    grants: new Set(['catalog.read', 'catalog.manage']),
  });
});

describe('category input boundary', () => {
  it('rejects identifiers and mutation fields outside the exported strict schemas', async () => {
    const {
      categoryCreateSchema,
      categoryParamsSchema,
      categoryUpdateSchema,
    } = await import('@/lib/categories/service');

    expect(categoryParamsSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ name: '配件', enterprise_id: ENTERPRISE_ID }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({ color: '#123456', created_at: '2026-01-01' }).success).toBe(false);
    expect(categoryUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('validates a directly invoked server action and never forwards a forged enterprise id', async () => {
    const client = createCategoryClient({ data: null, error: null });
    mocks.createClient.mockResolvedValue(client);
    const { createCategory } = await import('@/app/actions/categories');

    await expect(createCategory({
      name: '配件',
      enterprise_id: '44444444-4444-4444-8444-444444444444',
    } as never)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 422,
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'catalog.manage');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('uses the resolved enterprise for a valid server-action insert', async () => {
    const row = {
      id: CATEGORY_ID,
      enterprise_id: ENTERPRISE_ID,
      name: '配件',
      color: '#6366f1',
      description: null,
      created_at: '2026-08-23T00:00:00.000Z',
      updated_at: '2026-08-23T00:00:00.000Z',
    };
    const client = createCategoryClient({ data: row, error: null });
    mocks.createClient.mockResolvedValue(client);
    const { createCategory } = await import('@/app/actions/categories');

    await expect(createCategory({ name: '  配件  ' })).resolves.toEqual(row);
    expect(client.calls).toContainEqual(['insert', {
      enterprise_id: ENTERPRISE_ID,
      name: '配件',
      color: '#6366f1',
      description: null,
    }]);
  });
});

describe('category API contract', () => {
  it('returns the stable validation envelope for an injected create field', async () => {
    const client = createCategoryClient({ data: null, error: null });
    mocks.createClient.mockResolvedValue(client);
    const { POST } = await import('@/app/api/categories/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: '配件', enterprise_id: ENTERPRISE_ID }),
    }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_FAILED', message: '请求参数校验失败' },
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('maps a duplicate category name to a stable conflict response', async () => {
    const client = createCategoryClient({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    mocks.createClient.mockResolvedValue(client);
    const { POST } = await import('@/app/api/categories/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: '配件' }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'CATEGORY_NAME_CONFLICT', message: '分类名称已存在' },
    });
  });

  it('returns not found when an enterprise-scoped category id cannot be deleted', async () => {
    const client = createCategoryClient({ data: null, error: null });
    mocks.createClient.mockResolvedValue(client);
    const { DELETE } = await import('@/app/api/categories/[id]/route');

    const response = await DELETE(
      new NextRequest(`https://erp.example.com/api/categories/${CATEGORY_ID}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: CATEGORY_ID }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'CATEGORY_NOT_FOUND', message: '分类不存在' },
    });
    expect(client.calls).toContainEqual(['enterprise_id', ENTERPRISE_ID]);
    expect(client.calls).toContainEqual(['id', CATEGORY_ID]);
  });

  it('maps a category foreign-key delete failure to a stable conflict response', async () => {
    const client = createCategoryClient({
      data: null,
      error: { code: '23503', message: 'violates foreign key constraint' },
    });
    mocks.createClient.mockResolvedValue(client);
    const { DELETE } = await import('@/app/api/categories/[id]/route');

    const response = await DELETE(
      new NextRequest(`https://erp.example.com/api/categories/${CATEGORY_ID}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: CATEGORY_ID }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'CATEGORY_IN_USE', message: '分类正在使用中，无法删除' },
    });
  });

  it('rejects an empty update without issuing a database query', async () => {
    const client = createCategoryClient({ data: null, error: null });
    mocks.createClient.mockResolvedValue(client);
    const { PATCH } = await import('@/app/api/categories/[id]/route');

    const response = await PATCH(
      new NextRequest(`https://erp.example.com/api/categories/${CATEGORY_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: CATEGORY_ID }) },
    );

    expect(response.status).toBe(422);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('does not expose unknown database error details', async () => {
    const client = createCategoryClient({
      data: null,
      error: { code: 'XX001', message: 'sensitive database detail' },
    });
    mocks.createClient.mockResolvedValue(client);
    const { PATCH } = await import('@/app/api/categories/[id]/route');

    const response = await PATCH(
      new NextRequest(`https://erp.example.com/api/categories/${CATEGORY_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: '更新说明' }),
      }),
      { params: Promise.resolve({ id: CATEGORY_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: { code: 'CATEGORY_UPDATE_FAILED', message: '更新分类失败' },
    });
    expect(JSON.stringify(body)).not.toContain('sensitive database detail');
  });
});
