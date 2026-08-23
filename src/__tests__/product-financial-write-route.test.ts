import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';

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
      data: {
        id: PRODUCT_ID,
        order_id: '33333333-3333-4333-8333-333333333333',
        space_id: '44444444-4444-4444-8444-444444444444',
        product_no: 'P-01',
        product_name: '柜体',
        status: 'draft',
      },
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
    grants: new Set(['orders.update', 'finance.manage']),
  });
  mocks.from.mockImplementation(() => createQuery());
  mocks.rpc.mockResolvedValue({ data: [{ id: PRODUCT_ID }], error: null });
});

describe('order product financial update route', () => {
  it('sends status transitions to the guarded component RPC and never updates status directly', async () => {
    const { PATCH } = await import('@/app/api/products/[id]/route');
    const response = await PATCH(new Request(`https://erp.example.com/api/products/${PRODUCT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'pending' }),
    }), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('transition_order_component_status', {
      target_enterprise_id: ENTERPRISE_ID,
      target_type: 'product',
      target_id: PRODUCT_ID,
      target_expected_status: 'draft',
      target_status: 'pending',
      target_remark: '更新产品状态',
    });
    expect(mocks.updates).toEqual([]);
  });

  it('rejects mixed finance and non-finance updates before either can partially commit', async () => {
    const { PATCH } = await import('@/app/api/products/[id]/route');
    const response = await PATCH(new Request(`https://erp.example.com/api/products/${PRODUCT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({
        product_name: '柜体（新版）',
        quoted_amount: 12000,
        cost_amount: 8000,
        profit_amount: 4000,
        internal_remark: '内部核价',
      }),
    }), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(response.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.updates).toEqual([]);
  });

  it('sends a finance-only update to the guarded RPC', async () => {
    const { PATCH } = await import('@/app/api/products/[id]/route');
    const response = await PATCH(new Request(`https://erp.example.com/api/products/${PRODUCT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({
        quoted_amount: 12000,
        cost_amount: 8000,
        profit_amount: 4000,
        internal_remark: '内部核价',
      }),
    }), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('finance_update_order_product', {
      target_enterprise_id: ENTERPRISE_ID,
      target_product_id: PRODUCT_ID,
      target_quoted_amount: 12000,
      target_cost_amount: 8000,
      target_profit_amount: 4000,
      target_internal_remark: '内部核价',
      update_internal_remark: true,
    });
    expect(mocks.updates).toEqual([]);
  });

  it('does not issue a direct update for a finance-only request', async () => {
    const { PATCH } = await import('@/app/api/products/[id]/route');
    const response = await PATCH(new Request(`https://erp.example.com/api/products/${PRODUCT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ quoted_amount: 12000 }),
    }), { params: Promise.resolve({ id: PRODUCT_ID }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.updates).toEqual([]);
  });
});
