import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const WORKER_ID = '33333333-3333-4333-8333-333333333333';
const TASK_ID = '44444444-4444-4444-8444-444444444444';
const WORK_ORDER_ID = '55555555-5555-4555-8555-555555555555';

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
    const rpc = vi.fn().mockResolvedValue({
      data: { work_order: { id: WORK_ORDER_ID, status: 'producing', completed_quantity: 3 }, log: { id: '66666666-6666-4666-8666-666666666666' } },
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });
    const { POST } = await import('@/app/api/progress/report/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/progress/report', {
      method: 'POST',
      body: JSON.stringify({ work_order_id: WORK_ORDER_ID, action: 'report_progress', completed_delta: 3 }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { work_order: { id: WORK_ORDER_ID, status: 'producing', completed_quantity: 3 }, log: { id: '66666666-6666-4666-8666-666666666666' } } });
    expect(rpc).toHaveBeenCalledWith('report_work_order_progress', {
      target_enterprise_id: ENTERPRISE_ID,
      target_work_order_id: WORK_ORDER_ID,
      target_action: 'report_progress',
      target_completed_delta: 3,
      target_remark: null,
    });
  });

  it('delegates a worker status change to the atomic RPC without accepting a worker identity from the request', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: 'processing', message: '任务已开始' },
      error: null,
    });
    mocks.createClient.mockResolvedValue({ rpc });
    const { POST } = await import('@/app/api/worker/report/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/worker/report', {
      method: 'POST',
      body: JSON.stringify({ task_id: TASK_ID, action: 'start', worker_id: 'untrusted-worker-id' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, message: '任务已开始', status: 'processing' });
    expect(rpc).toHaveBeenCalledWith('report_worker_task', {
      target_enterprise_id: ENTERPRISE_ID,
      target_task_id: TASK_ID,
      target_action: 'start',
    });
  });

  it('maps an atomic task-status conflict to 409', async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'TASK_STATUS_CONFLICT' } }),
    });
    const { POST } = await import('@/app/api/worker/report/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/worker/report', {
      method: 'POST',
      body: JSON.stringify({ task_id: TASK_ID, action: 'start' }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ success: false, error: '当前任务状态不允许该操作' });
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'production.report.self');
  });
});
