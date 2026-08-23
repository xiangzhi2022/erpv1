import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { EnterpriseAccessError } from '@/lib/enterprise/errors';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '33333333-3333-4333-8333-333333333333';

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

type Filter = [column: string, value: unknown];

function createScopedClient({
  orderExists = true,
  orderStatus = 'pending',
}: {
  orderExists?: boolean;
  orderStatus?: string;
} = {}) {
  return {
    from(table: string) {
      const filters: Filter[] = [];
      let selectedColumns = '';
      let isUpdate = false;
      let isMaybeSingle = false;
      const result = () => {
        const inEnterprise = filters.some(([column, value]) => (
          column === 'enterprise_id' && value === ENTERPRISE_ID
        ));
        const forFactory = filters.some(([column, value]) => (
          column === 'target_factory_id' && value === ENTERPRISE_ID
        ));
        if (table === 'orders') {
          if (!inEnterprise || !forFactory) return { data: null, error: { code: 'SCOPE_MISSING' } };
          if (isUpdate) {
            const expectedStatus = filters.find(([column]) => column === 'status')?.[1];
            return {
              data: orderExists && orderStatus === 'pending' && expectedStatus === orderStatus ? { id: ORDER_ID } : null,
              error: null,
            };
          }
          if (selectedColumns === 'id,status') {
            if (isMaybeSingle) return { data: orderExists ? { id: ORDER_ID, status: orderStatus } : null, error: null };
            return { data: [{ id: ORDER_ID, status: 'pending' }], error: null };
          }
          return {
            data: [{
              id: ORDER_ID,
              order_no: 'ORD-001',
              customer_name: '李四',
              customer_phone: '13800000000',
              status: orderStatus,
              total_amount: 2500,
              delivery_date: '2026-09-01',
              remark: '送货前联系',
              dealer_id: '22222222-2222-4222-8222-222222222222',
              from_enterprise_id: '22222222-2222-4222-8222-222222222222',
              target_factory_id: ENTERPRISE_ID,
              created_at: '2026-08-01T00:00:00Z',
              updated_at: '2026-08-02T00:00:00Z',
              cost_amount: 1000,
              profit_amount: 1500,
              internal_remark: '仅限内部',
              items: [{
                id: 'item-1',
                product_name: '衣柜',
                quantity: 1,
                unit_price: 2500,
                subtotal: 2500,
                cost_amount: 1000,
                estimated_wage_amount: 200,
              }],
            }],
            error: null,
          };
        }
        if (table === 'production_tasks') {
          if (!inEnterprise) return { data: null, error: { code: 'SCOPE_MISSING' } };
          return { data: [{ order_id: ORDER_ID, status: 'completed', final_wage_amount: 200 }], error: null };
        }
        if (table === 'enterprises') {
          return { data: [{ id: '22222222-2222-4222-8222-222222222222', name: '经销商甲', internal_remark: '不应泄露' }], error: null };
        }
        return { data: [], error: null };
      };
      const query = {
        select: vi.fn((columns: string) => {
          selectedColumns = columns.replace(/\s/g, '');
          return query;
        }),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        }),
        in: vi.fn(() => query),
        or: vi.fn(() => query),
        order: vi.fn(() => query),
        update: vi.fn(() => {
          isUpdate = true;
          return query;
        }),
        maybeSingle: vi.fn(() => {
          isMaybeSingle = true;
          return query;
        }),
        then(resolve: (value: ReturnType<typeof result>) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEnterpriseContext.mockResolvedValue({
    userId: 'user-1',
    enterpriseId: ENTERPRISE_ID,
    grants: new Set(['orders.read', 'orders.accept']),
  });
  const client = createScopedClient();
  mocks.createClient.mockResolvedValue(client);
});

describe('factory orders API', () => {
  it('returns only factory-scoped, safe dashboard order fields', async () => {
    const { GET } = await import('@/app/api/factory/orders/route');

    const response = await GET(new NextRequest('https://erp.example.com/api/factory/orders'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      orders: [{
        id: ORDER_ID,
        order_no: 'ORD-001',
        customer_name: '李四',
        customer_phone: '13800000000',
        status: 'pending',
        total_amount: 2500,
        delivery_date: '2026-09-01',
        remark: '送货前联系',
        target_factory_id: ENTERPRISE_ID,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-02T00:00:00Z',
        items: [{ id: 'item-1', product_name: '衣柜', quantity: 1, unit_price: 2500, subtotal: 2500 }],
        dealer: { id: '22222222-2222-4222-8222-222222222222', name: '经销商甲' },
        total_tasks: 1,
        completed_tasks: 1,
        progress: 100,
      }],
      stats: { pending: 1, confirmed: 0, producing: 0, shipped: 0, completed: 0 },
      taskStats: { total: 1, completed: 1 },
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'orders.read');
  });

  it('accepts an order only inside the active enterprise and factory scope', async () => {
    const { POST } = await import('@/app/api/factory/orders/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/factory/orders', {
      method: 'POST',
      body: JSON.stringify({ order_id: ORDER_ID }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, message: '订单已接收' });
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'orders.accept');
  });

  it.each([
    'https://erp.example.com/api/factory/orders?keyword=%25',
    'https://erp.example.com/api/factory/orders?status=not-a-status',
  ])('rejects invalid order filters before building a PostgREST expression', async (url) => {
    const { GET } = await import('@/app/api/factory/orders/route');

    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(422);
  });

  it('validates the accepted order ID as a UUID', async () => {
    const { POST } = await import('@/app/api/factory/orders/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/factory/orders', {
      method: 'POST',
      body: JSON.stringify({ order_id: 'not-a-uuid' }),
    }));

    expect(response.status).toBe(422);
  });

  it('returns 404 when the active enterprise has no matching order to accept', async () => {
    mocks.createClient.mockResolvedValue(createScopedClient({ orderExists: false }));
    const { POST } = await import('@/app/api/factory/orders/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/factory/orders', {
      method: 'POST',
      body: JSON.stringify({ order_id: ORDER_ID }),
    }));

    expect(response.status).toBe(404);
  });

  it.each(['completed', 'cancelled'])('rejects acceptance of an already %s order', async (orderStatus) => {
    mocks.createClient.mockResolvedValue(createScopedClient({ orderStatus }));
    const { POST } = await import('@/app/api/factory/orders/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/factory/orders', {
      method: 'POST',
      body: JSON.stringify({ order_id: ORDER_ID }),
    }));

    expect(response.status).toBe(409);
  });

  it('preserves enterprise authentication failures', async () => {
    mocks.getEnterpriseContext.mockRejectedValue(new EnterpriseAccessError(
      'IDENTITY_REQUIRED',
      401,
      '请先登录',
    ));
    const { GET } = await import('@/app/api/factory/orders/route');

    const response = await GET(new NextRequest('https://erp.example.com/api/factory/orders'));

    expect(response.status).toBe(401);
  });
});
