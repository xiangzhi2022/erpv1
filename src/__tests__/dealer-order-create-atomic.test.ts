import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const FACTORY_ID = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
  getEnterpriseContext: vi.fn(),
  requirePermission: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mocks.from, rpc: mocks.rpc })),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.getEnterpriseContext.mockResolvedValue({
    enterpriseId: ENTERPRISE_ID,
    enterpriseType: 'dealer',
    userId: 'user-1',
    grants: new Set(['orders.create']),
  });
  mocks.rpc.mockResolvedValue({
    data: { id: ORDER_ID, order_no: 'ORD202608230001', status: 'pending' },
    error: null,
  });
  mocks.from.mockImplementation(() => {
    throw new Error('dealer creation must not perform direct table writes');
  });
});

describe('dealer order creation transaction boundary', () => {
  it('creates the order and all items with one RPC for an orders.create-only user', async () => {
    const { POST } = await import('@/app/api/dealer/orders/create/route');
    const response = await POST(new Request('https://erp.example.com/api/dealer/orders/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: '测试客户',
        customerPhone: '13800000000',
        deliveryDate: '2026-08-30',
        targetFactoryId: FACTORY_ID,
        remark: '整单原子创建',
        items: [
          { productName: '柜体', specification: '橡木', quantity: 2, unitPrice: 12.345 },
          { productName: '门板', quantity: 1, unitPrice: 0.1 },
        ],
      }),
    }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      order: { id: ORDER_ID, orderNo: 'ORD202608230001', status: 'pending' },
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'orders.create');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('create_dealer_order_with_items', {
      target_enterprise_id: ENTERPRISE_ID,
      target_factory_id: FACTORY_ID,
      target_order: {
        customer_name: '测试客户',
        customer_phone: '13800000000',
        delivery_date: '2026-08-30',
        remark: '整单原子创建',
        items: [
          { product_name: '柜体', specification: '橡木', quantity: 2, unit_price: 12.345 },
          { product_name: '门板', specification: null, quantity: 1, unit_price: 0.1 },
        ],
      },
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('does not issue a compensating delete when the atomic RPC fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '22023' } });
    const { POST } = await import('@/app/api/dealer/orders/create/route');
    const response = await POST(new Request('https://erp.example.com/api/dealer/orders/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: '测试客户',
        targetFactoryId: FACTORY_ID,
        items: [{ productName: '柜体', quantity: 1, unitPrice: 1 }],
      }),
    }) as never);

    expect(response.status).toBe(500);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('preserves the unavailable-factory validation response from the atomic RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'DEALER_ORDER_FACTORY_INVALID' },
    });
    const { POST } = await import('@/app/api/dealer/orders/create/route');
    const response = await POST(new Request('https://erp.example.com/api/dealer/orders/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerName: '测试客户',
        targetFactoryId: FACTORY_ID,
        items: [{ productName: '柜体', quantity: 1, unitPrice: 1 }],
      }),
    }) as never);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ success: false, error: '目标工厂不可用' });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
