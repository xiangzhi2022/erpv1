import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const SPACE_ID = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  getEnterpriseContext: vi.fn(),
  requirePermission: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mocks.from, rpc: mocks.rpc })),
}));

function createQuery() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    update: vi.fn((payload: Record<string, unknown>) => {
      mocks.updates.push(payload);
      return query;
    }),
    maybeSingle: vi.fn(async () => ({
      data: { id: SPACE_ID, space_name: '厨房', status: 'draft' },
      error: null,
    })),
    single: vi.fn(async () => ({
      data: { id: SPACE_ID, space_name: '厨房', status: 'pending' },
      error: null,
    })),
  };
  return query;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.updates.length = 0;
  mocks.getEnterpriseContext.mockResolvedValue({
    enterpriseId: ENTERPRISE_ID,
    userId: 'user-1',
    grants: new Set(['orders.update']),
  });
  mocks.from.mockImplementation(() => createQuery());
  mocks.rpc.mockResolvedValue({ data: { id: SPACE_ID, status: 'pending' }, error: null });
});

describe('order space status route', () => {
  it('uses the guarded component RPC and keeps status out of direct updates', async () => {
    const { PATCH } = await import('@/app/api/spaces/[id]/route');
    const response = await PATCH(new Request(`https://erp.example.com/api/spaces/${SPACE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pending' }),
    }), { params: Promise.resolve({ id: SPACE_ID }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('transition_order_component_status', {
      target_enterprise_id: ENTERPRISE_ID,
      target_type: 'space',
      target_id: SPACE_ID,
      target_expected_status: 'draft',
      target_status: 'pending',
      target_remark: '更新空间状态',
    });
    expect(mocks.updates).toEqual([]);
  });

  it('rejects mixed base-field and status changes before either write can run', async () => {
    const { PATCH } = await import('@/app/api/spaces/[id]/route');
    const response = await PATCH(new Request(`https://erp.example.com/api/spaces/${SPACE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ space_name: '主卧', status: 'pending' }),
    }), { params: Promise.resolve({ id: SPACE_ID }) });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: '基础字段和状态请分别提交',
    });
    expect(mocks.updates).toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
