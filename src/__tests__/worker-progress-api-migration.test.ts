import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const WORKER_ID = '33333333-3333-4333-8333-333333333333';
const TASK_ID = '44444444-4444-4444-8444-444444444444';
const WORK_ORDER_ID = '55555555-5555-4555-8555-555555555555';
const IDEMPOTENCY_KEY = 'worker-progress-operation';
const CLAIM_TOKEN = '77777777-7777-4777-8777-777777777777';

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
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 119,
    retryAfterSeconds: 0,
  }),
}));

type Filter = readonly [string, unknown];

function createWorkerReportClient(taskStatus = 'completed') {
  return {
    from(table: string) {
      const filters: Filter[] = [];
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push([column, value]);
          return query;
        }),
        or: vi.fn(() => query),
        update: vi.fn(() => query),
        maybeSingle: vi.fn(() => {
          if (table === 'workers') {
            const isBoundWorker = filters.some(([column, value]) => column === 'user_id' && value === USER_ID)
              && filters.some(([column, value]) => column === 'enterprise_id' && value === ENTERPRISE_ID);
            return Promise.resolve({ data: isBoundWorker ? { id: WORKER_ID } : null, error: null });
          }
          if (table === 'production_tasks') {
            const isScopedTask = filters.some(([column, value]) => column === 'id' && value === TASK_ID)
              && filters.some(([column, value]) => column === 'enterprise_id' && value === ENTERPRISE_ID);
            return Promise.resolve({
              data: isScopedTask ? { id: TASK_ID, status: taskStatus, order_id: null } : null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      return query;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEnterpriseContext.mockResolvedValue({
    userId: USER_ID,
    enterpriseId: ENTERPRISE_ID,
    grants: new Set(['production.report.self']),
  });
  mocks.createClient.mockResolvedValue(createWorkerReportClient());
});

describe('worker progress API enterprise boundary', () => {
  it('delegates a work-order progress update to the atomic RPC', async () => {
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === 'claim_api_idempotency') {
        return { data: [{ outcome: 'claimed', response_status: null, response_body: null, claim_token: CLAIM_TOKEN }], error: null };
      }
      if (functionName === 'report_work_order_progress') {
        return {
          data: { work_order: { id: WORK_ORDER_ID, status: 'producing', completed_quantity: 3 }, log: { id: '66666666-6666-4666-8666-666666666666' } },
          error: null,
        };
      }
      return { data: [{ outcome: 'completed' }], error: null };
    });
    mocks.createClient.mockResolvedValue({ rpc });
    const { POST } = await import('@/app/api/progress/report/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/progress/report', {
      method: 'POST',
      headers: { 'Idempotency-Key': IDEMPOTENCY_KEY },
      body: JSON.stringify({ work_order_id: WORK_ORDER_ID, action: 'report_progress', completed_delta: 3 }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { work_order: { id: WORK_ORDER_ID, status: 'producing', completed_quantity: 3 }, log: { id: '66666666-6666-4666-8666-666666666666' } } });
    expect(rpc).toHaveBeenNthCalledWith(2, 'report_work_order_progress', {
      target_enterprise_id: ENTERPRISE_ID,
      target_work_order_id: WORK_ORDER_ID,
      target_action: 'report_progress',
      target_completed_delta: 3,
      target_remark: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, 'complete_api_idempotency', expect.objectContaining({
      target_enterprise_id: ENTERPRISE_ID,
      target_idempotency_key: IDEMPOTENCY_KEY,
      target_claim_token: CLAIM_TOKEN,
      completed_status: 200,
    }));
  });

  it('delegates a worker status change to the atomic RPC without accepting a worker identity from the request', async () => {
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === 'claim_api_idempotency') {
        return { data: [{ outcome: 'claimed', response_status: null, response_body: null, claim_token: CLAIM_TOKEN }], error: null };
      }
      if (functionName === 'report_worker_task') {
        return { data: { status: 'processing', message: '任务已开始' }, error: null };
      }
      return { data: [{ outcome: 'completed' }], error: null };
    });
    mocks.createClient.mockResolvedValue({ rpc });
    const { POST } = await import('@/app/api/worker/report/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/worker/report', {
      method: 'POST',
      headers: { 'Idempotency-Key': IDEMPOTENCY_KEY },
      body: JSON.stringify({ task_id: TASK_ID, action: 'start', worker_id: 'untrusted-worker-id' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, message: '任务已开始', status: 'processing' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'report_worker_task', {
      target_enterprise_id: ENTERPRISE_ID,
      target_task_id: TASK_ID,
      target_action: 'start',
    });
  });

  it('maps an atomic task-status conflict to 409', async () => {
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === 'claim_api_idempotency') {
        return { data: [{ outcome: 'claimed', response_status: null, response_body: null, claim_token: CLAIM_TOKEN }], error: null };
      }
      if (functionName === 'report_worker_task') {
        return { data: null, error: { code: 'P0001', message: 'TASK_STATUS_CONFLICT' } };
      }
      return { data: [{ outcome: 'completed' }], error: null };
    });
    mocks.createClient.mockResolvedValue({
      rpc,
    });
    const { POST } = await import('@/app/api/worker/report/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/worker/report', {
      method: 'POST',
      headers: { 'Idempotency-Key': IDEMPOTENCY_KEY },
      body: JSON.stringify({ task_id: TASK_ID, action: 'start' }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ success: false, error: '当前任务状态不允许该操作' });
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'production.report.self');
  });

  it('requires an idempotency key before invoking a report RPC', async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ rpc });
    const { POST } = await import('@/app/api/progress/report/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/progress/report', {
      method: 'POST',
      body: JSON.stringify({ work_order_id: WORK_ORDER_ID, action: 'report_progress', completed_delta: 1 }),
    }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('replays a completed report without invoking the business RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        outcome: 'replay',
        response_status: 200,
        response_body: { success: true, data: { replayed: true } },
        claim_token: null,
      }],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });
    const { POST } = await import('@/app/api/progress/report/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/progress/report', {
      method: 'POST',
      headers: { 'Idempotency-Key': IDEMPOTENCY_KEY },
      body: JSON.stringify({ work_order_id: WORK_ORDER_ID, action: 'report_progress', completed_delta: 1 }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { replayed: true } });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('claim_api_idempotency', expect.objectContaining({
      target_enterprise_id: ENTERPRISE_ID,
      target_idempotency_key: IDEMPOTENCY_KEY,
    }));
  });

  it('replays work-order creation without reading or writing business tables', async () => {
    const from = vi.fn();
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        outcome: 'replay',
        response_status: 201,
        response_body: { success: true, data: { id: WORK_ORDER_ID } },
        claim_token: null,
      }],
      error: null,
    });
    mocks.createClient.mockResolvedValue({ from, rpc });
    const { POST } = await import('@/app/api/progress/work-orders/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/progress/work-orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': IDEMPOTENCY_KEY },
      body: JSON.stringify({ product_name: '餐桌', target_quantity: 2 }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: WORK_ORDER_ID } });
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).not.toHaveBeenCalled();
  });

  it('delegates work-order creation and its initial log to one atomic RPC', async () => {
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === 'claim_api_idempotency') {
        return { data: [{ outcome: 'claimed', response_status: null, response_body: null, claim_token: CLAIM_TOKEN }], error: null };
      }
      if (functionName === 'create_production_work_order') {
        return { data: { id: WORK_ORDER_ID, product_name: '餐桌', target_quantity: 2, completed_quantity: 0, status: 'pending', priority: 'normal', order_id: null, workshop_id: null, expected_end_date: null, remark: null }, error: null };
      }
      return { data: [{ outcome: 'completed' }], error: null };
    });
    mocks.createClient.mockResolvedValue({ rpc });
    const { POST } = await import('@/app/api/progress/work-orders/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/progress/work-orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': IDEMPOTENCY_KEY },
      body: JSON.stringify({ product_name: '餐桌', target_quantity: 2 }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: WORK_ORDER_ID, product_name: '餐桌', target_quantity: 2, completed_quantity: 0, status: 'pending', priority: 'normal', order_id: null, workshop_id: null, expected_end_date: null, remark: null } });
    expect(rpc).toHaveBeenNthCalledWith(2, 'create_production_work_order', {
      target_enterprise_id: ENTERPRISE_ID,
      target_order_id: null,
      target_workshop_id: null,
      target_product_name: '餐桌',
      target_quantity: 2,
      target_priority: 'normal',
      target_expected_end_date: null,
      target_remark: null,
    });
  });
});
