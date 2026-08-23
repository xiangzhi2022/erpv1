import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  getEnterpriseContext: vi.fn(),
  hasEnterprisePermission: vi.fn(),
  requirePermission: vi.fn(),
  createClient: vi.fn(),
  getSupabaseClient: vi.fn(),
  getUserFromRequest: vi.fn(),
  populatedExistingOrder: false,
  includeListItem: false,
  itemAmounts: [] as Array<{ id: string; order_id: string; unit_price: number; subtotal: number }>,
  rpcResult: {
    data: {
      id: 'order-1',
      order_no: 'SO-ATOMIC-1',
      enterprise_id: '11111111-1111-4111-8111-111111111111',
      tenant_id: '11111111-1111-4111-8111-111111111111',
      customer_name: '客户',
      status: 'pending',
      total_amount: 10000,
      items: [],
      modules: [],
    },
    error: null,
  } as { data: Record<string, unknown> | null; error: { code?: string; message?: string } | null },
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

class Query {
  constructor(private readonly table: string) {}

  select(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'select', args }); return this; }
  eq(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'eq', args }); return this; }
  neq(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'neq', args }); return this; }
  in(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'in', args }); return this; }
  or(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'or', args }); return this; }
  order(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'order', args }); return this; }
  range(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'range', args }); return this; }
  limit(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'limit', args }); return this; }
  update(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'update', args }); return this; }
  delete(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'delete', args }); return this; }
  maybeSingle() {
    if (this.table === 'enterprises') return Promise.resolve({ data: { id: 'factory-1', enterprise_type: 'manufacturer', status: 'active' }, error: null });
    return Promise.resolve({ data: null, error: null });
  }
  then<TResult1 = { data: unknown[]; error: null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const result = this.table === 'order_modules' && mocks.populatedExistingOrder
      ? { data: [{ id: 'module-1' }], error: null }
      : this.table === 'orders'
      ? {
          data: [{
            id: 'order-1', order_no: 'SO-1', enterprise_id: ENTERPRISE_ID,
            from_enterprise_id: ENTERPRISE_ID, to_enterprise_id: null,
            customer_name: '客户', customer_phone: null, status: 'pending',
            total_amount: 1000, delivery_date: null, remark: null,
            order_flow: 'dealer_to_factory', parent_order_id: null,
            target_factory_id: null, dealer_id: null, created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            items: mocks.includeListItem ? [{
              id: 'item-1', enterprise_id: ENTERPRISE_ID, order_id: 'order-1', module_id: null,
              item_no: 'I-1', product_name: '衣柜', specifications: null, woodworking_craft: null,
              forming_craft: null, painting_craft: null, length_mm: null, width_mm: null,
              thickness_mm: null, quantity: 1, unit: '件', color: null, hardware: null,
              hardware_quantity: null, construction_surface: null, remark: null, sort_order: 1,
              created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
            }] : [],
            cost_amount: 700, profit_amount: 300, internal_remark: 'internal only',
          }],
          error: null,
          count: 1,
        }
      : { data: [], error: null };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

const client = {
  from: vi.fn((table: string) => new Query(table)),
  rpc: vi.fn((name: string) => Promise.resolve(
    name === 'finance_list_order_item_amounts'
      ? { data: mocks.itemAmounts, error: null }
      : mocks.rpcResult,
  )),
};

vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  hasEnterprisePermission: mocks.hasEnterprisePermission,
  requirePermission: mocks.requirePermission,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/db/client', () => ({ getSupabaseClient: mocks.getSupabaseClient }));
vi.mock('@/lib/auth', () => ({ getUserFromRequest: mocks.getUserFromRequest }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls.length = 0;
  mocks.populatedExistingOrder = false;
  mocks.includeListItem = false;
  mocks.itemAmounts = [];
  mocks.hasEnterprisePermission.mockReturnValue(false);
  mocks.rpcResult = {
    data: {
      id: 'order-1', order_no: 'SO-ATOMIC-1', enterprise_id: ENTERPRISE_ID,
      tenant_id: ENTERPRISE_ID, customer_name: '客户', status: 'pending',
      total_amount: 10000, items: [], modules: [],
    },
    error: null,
  };
  mocks.getEnterpriseContext.mockResolvedValue({
    enterpriseId: ENTERPRISE_ID,
    userId: 'user-1',
    enterpriseType: 'dealer',
    grants: new Set(['orders.read']),
  });
  mocks.createClient.mockResolvedValue(client);
  mocks.getSupabaseClient.mockReturnValue(client);
  mocks.getUserFromRequest.mockResolvedValue({
    id: 'user-1', role: 'dealer_admin', tenant_id: ENTERPRISE_ID, tenant_type: 'dealer', permissions: [],
  });
});

describe('aggregate orders API', () => {
  it('uses the active enterprise for the list and does not return internal financial fields', async () => {
    const { GET } = await import('@/app/api/orders/route');
    const response = await GET(new Request('https://erp.example.com/api/orders?mode=dealer'));

    expect(response.status).toBe(200);
    expect(mocks.getEnterpriseContext).toHaveBeenCalledOnce();
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.objectContaining({ enterpriseId: ENTERPRISE_ID }), 'orders.read');
    expect(mocks.calls).toContainEqual({ table: 'orders', method: 'eq', args: ['enterprise_id', ENTERPRISE_ID] });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: [expect.not.objectContaining({ cost_amount: expect.anything(), profit_amount: expect.anything(), internal_remark: expect.anything() })],
    });
  });

  it('applies the receiving-enterprise scope for a factory inbox', async () => {
    mocks.getEnterpriseContext.mockResolvedValue({
      enterpriseId: ENTERPRISE_ID,
      userId: 'user-1',
      enterpriseType: 'manufacturer',
      grants: new Set(['orders.read']),
    });
    const { GET } = await import('@/app/api/orders/route');
    const response = await GET(new Request('https://erp.example.com/api/orders?mode=factory_received'));

    expect(response.status).toBe(200);
    expect(mocks.calls).toContainEqual({ table: 'orders', method: 'eq', args: ['order_flow', 'dealer_to_factory'] });
    expect(mocks.calls).toContainEqual({ table: 'orders', method: 'eq', args: ['to_enterprise_id', ENTERPRISE_ID] });
  });

  it('batch-enriches item prices only for enterprise finance readers', async () => {
    mocks.hasEnterprisePermission.mockReturnValue(true);
    mocks.includeListItem = true;
    mocks.itemAmounts = [{ id: 'item-1', order_id: 'order-1', unit_price: 2500, subtotal: 2500 }];
    const { GET } = await import('@/app/api/orders/route');
    const response = await GET(new Request('https://erp.example.com/api/orders?mode=dealer'));

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith('finance_list_order_item_amounts', {
      target_enterprise_id: ENTERPRISE_ID,
      target_order_ids: ['order-1'],
    });
    await expect(response.json()).resolves.toMatchObject({
      data: [{ items: [{ id: 'item-1', unit_price: 2500, subtotal: 2500 }] }],
    });
  });

  it('rejects unsafe search input before opening a database client', async () => {
    const { GET } = await import('@/app/api/orders/route');
    const response = await GET(new Request('https://erp.example.com/api/orders?search=%25'));

    expect(response.status).toBe(422);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('maps malformed order bodies to a safe client error before database writes', async () => {
    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(new Request('https://erp.example.com/api/orders', {
      method: 'POST',
      body: '{broken',
    }));

    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('saves the complete order tree through one atomic RPC without direct table mutations', async () => {
    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(new Request('https://erp.example.com/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        order_no: 'SO-ATOMIC-1',
        order_flow: 'dealer_to_factory',
        to_tenant_id: 'factory-1',
        target_factory_id: 'factory-1',
        customer_name: '客户',
        modules: [{
          module_name: '主卧',
          items: [{
            product_name: '衣柜', quantity: 1, unit: '件', unit_price: 100,
            tasks: [{ task_type: 'board', task_name: '开料', quantity: 1, unit: '件' }],
            attachments: [{ file_name: 'drawing.pdf', file_path: 'orders/drawing.pdf', file_url: 'https://files.example/drawing.pdf' }],
          }],
        }],
      }),
    }));

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledWith('save_order_tree', {
      target_enterprise_id: ENTERPRISE_ID,
      target_existing_order_id: null,
      target_order: expect.objectContaining({
        order_no: 'SO-ATOMIC-1',
        order_flow: 'dealer_to_factory',
        to_tenant_id: 'factory-1',
      }),
    });
    expect(client.from).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: 'order-1', order_no: 'SO-ATOMIC-1' },
    });
  });

  it('maps the atomic RPC populated-tree conflict without attempting compensation writes', async () => {
    mocks.rpcResult = {
      data: null,
      error: { code: 'P0001', message: 'ORDER_TREE_NOT_EMPTY' },
    };
    const { POST } = await import('@/app/api/orders/route');
    const response = await POST(new Request('https://erp.example.com/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        existing_order_id: 'order-1',
        order_no: 'SO-2',
        order_flow: 'dealer_to_factory',
        to_tenant_id: 'factory-1',
        target_factory_id: 'factory-1',
        customer_name: '客户',
        modules: [{
          module_name: '主卧',
          items: [{ product_name: '衣柜', quantity: 1, unit: '件', unit_price: 100 }],
        }],
      }),
    }));

    expect(response.status).toBe(409);
    expect(client.rpc).toHaveBeenCalledOnce();
    expect(client.from).not.toHaveBeenCalled();
    expect(mocks.calls.filter((call) => call.method === 'update' || call.method === 'delete')).toEqual([]);
  });

  it('requires production permissions before accepting embedded task writes', async () => {
    const { EnterpriseAccessError } = await import('@/lib/enterprise/errors');
    mocks.requirePermission.mockImplementation((_context, permission: string) => {
      if (permission === 'production.plan') {
        throw new EnterpriseAccessError('ENTERPRISE_PERMISSION_DENIED', 403, '没有执行该操作的权限');
      }
    });
    const { POST } = await import('@/app/api/orders/route');

    const response = await POST(new Request('https://erp.example.com/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        order_no: 'SO-3',
        order_flow: 'dealer_to_factory',
        to_tenant_id: 'factory-1',
        target_factory_id: 'factory-1',
        customer_name: '客户',
        modules: [{
          module_name: '主卧',
          items: [{
            product_name: '衣柜',
            quantity: 1,
            unit: '件',
            unit_price: 100,
            tasks: [{ task_type: 'board', task_name: '开料', quantity: 1, unit: '件' }],
          }],
        }],
      }),
    }));

    expect(response.status).toBe(403);
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'production.plan');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
