import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  getEnterpriseContext: vi.fn(),
  requirePermission: vi.fn(),
  from: vi.fn(),
  queries: [] as Array<{
    table: string;
    filters: Array<[string, unknown]>;
    inserts: unknown[];
    updates: unknown[];
  }>,
}));

vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mocks.from })),
}));

function responseFor(table: string, operation: string) {
  if (operation === 'update' && table === 'orders') {
    return { data: { id: ORDER_ID, status: 'confirmed' }, error: null };
  }
  if (table === 'orders') {
    return {
      data: {
        id: ORDER_ID,
        enterprise_id: ENTERPRISE_ID,
        order_no: 'SO-001',
        customer_name: '客户',
        status: 'pending',
        total_amount: 1000,
        cost_amount: 600,
        profit_amount: 400,
        deposit_amount: 100,
        internal_remark: '仅内部可见',
      },
      error: null,
    };
  }
  if (table === 'order_spaces') {
    return { data: [{ id: 'space-1', enterprise_id: ENTERPRISE_ID, order_id: ORDER_ID }], error: null };
  }
  if (table === 'order_products') {
    return {
      data: [{
        id: 'product-1', enterprise_id: ENTERPRISE_ID, order_id: ORDER_ID, space_id: 'space-1',
        product_name: '柜体', cost_amount: 600, profit_amount: 400, internal_remark: '成本备注',
      }],
      error: null,
    };
  }
  if (table === 'production_tasks') {
    return {
      data: [{
        id: 'task-1', enterprise_id: ENTERPRISE_ID, order_id: ORDER_ID, product_id: 'product-1',
        assigned_worker_id: 'worker-1', worker_id: 'worker-1', assigned_to: 'user-1',
      }],
      error: null,
    };
  }
  if (table === 'workers') {
    return {
      data: [{ id: 'worker-1', name: '张师傅', worker_no: 'WK-001', craft_type: '木工', user_id: 'user-1' }],
      error: null,
    };
  }
  return { data: [], error: null };
}

function createQuery(table: string) {
  const record = { table, filters: [] as Array<[string, unknown]>, inserts: [] as unknown[], updates: [] as unknown[] };
  mocks.queries.push(record);
  let operation = 'select';
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((field: string, value: unknown) => {
      record.filters.push([field, value]);
      return query;
    }),
    in: vi.fn((field: string, value: unknown) => {
      record.filters.push([field, value]);
      return query;
    }),
    order: vi.fn(() => query),
    update: vi.fn((payload: unknown) => {
      operation = 'update';
      record.updates.push(payload);
      return query;
    }),
    insert: vi.fn((payload: unknown) => {
      operation = 'insert';
      record.inserts.push(payload);
      return query;
    }),
    delete: vi.fn(() => {
      operation = 'delete';
      return query;
    }),
    maybeSingle: vi.fn(async () => responseFor(table, operation)),
    single: vi.fn(async () => responseFor(table, operation)),
    then: <TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(responseFor(table, operation)).then(onfulfilled, onrejected),
  };
  return query;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.requirePermission.mockReset();
  mocks.queries.length = 0;
  mocks.getEnterpriseContext.mockResolvedValue({
    enterpriseId: ENTERPRISE_ID,
    enterpriseType: 'dealer',
    userId: 'user-1',
    grants: new Set(['orders.read', 'orders.update']),
  });
  mocks.from.mockImplementation(createQuery);
});

function params(id = ORDER_ID) {
  return { params: Promise.resolve({ id }) };
}

function expectEnterpriseScope(table: string) {
  const query = mocks.queries.find((candidate) => candidate.table === table);
  expect(query).toBeDefined();
  expect(query?.filters).toContainEqual(['enterprise_id', ENTERPRISE_ID]);
}

describe('order detail API', () => {
  it('scopes its detail tree to the active enterprise and hides partner internals', async () => {
    const { GET } = await import('@/app/api/orders/[id]/route');
    const response = await GET(new Request(`https://erp.example.com/api/orders/${ORDER_ID}`), params());

    expect(response.status).toBe(200);
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'orders.read');
    for (const table of ['orders', 'order_spaces', 'order_products', 'production_tasks', 'order_status_logs']) {
      expectEnterpriseScope(table);
    }
    const body = await response.json();
    expect(body.data).not.toHaveProperty('cost_amount');
    expect(body.data).not.toHaveProperty('profit_amount');
    expect(body.data.spaces[0].products[0]).not.toHaveProperty('cost_amount');
    expect(body.data.spaces[0].products[0]).not.toHaveProperty('profit_amount');
    const task = body.data.spaces[0].products[0].production_tasks[0];
    expect(task).not.toHaveProperty('worker');
    expect(task).not.toHaveProperty('assigned_worker_id');
    expect(task).not.toHaveProperty('worker_id');
    expect(task).not.toHaveProperty('assigned_to');
  });

  it('rejects invalid order IDs before querying', async () => {
    const { GET } = await import('@/app/api/orders/[id]/route');
    const response = await GET(new Request('https://erp.example.com/api/orders/not-a-uuid'), params('not-a-uuid'));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ success: false, error: '请求参数校验失败' });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('forbids partners from writing internal financial fields', async () => {
    const { PATCH } = await import('@/app/api/orders/[id]/route');
    const response = await PATCH(new Request(`https://erp.example.com/api/orders/${ORDER_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ internal_remark: '请勿暴露', cost_amount: 1, profit_amount: 1 }),
    }), params());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, error: '无权修改内部字段' });
    expect(mocks.queries.some((query) => query.table === 'orders' && query.updates.length > 0)).toBe(false);
  });

  it('preserves enterprise authorization failures', async () => {
    const { EnterpriseAccessError } = await import('@/lib/enterprise/errors');
    mocks.requirePermission.mockImplementation(() => {
      throw new EnterpriseAccessError('ENTERPRISE_PERMISSION_DENIED', 403, '没有执行该操作的权限');
    });
    const { GET } = await import('@/app/api/orders/[id]/route');
    const response = await GET(new Request(`https://erp.example.com/api/orders/${ORDER_ID}`), params());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ success: false, error: '没有执行该操作的权限' });
  });

  it('uses enterprise-scoped writes and returns a safe update error', async () => {
    mocks.from.mockImplementation((table: string) => {
      const query = createQuery(table);
      if (table === 'orders') query.single.mockResolvedValue({
        data: null,
        error: { message: 'relation orders does not exist' },
      });
      return query;
    });
    const { PATCH } = await import('@/app/api/orders/[id]/route');
    const response = await PATCH(new Request(`https://erp.example.com/api/orders/${ORDER_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'confirmed' }),
    }), params());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ success: false, error: '更新订单失败' });
    expectEnterpriseScope('orders');
  });
});
