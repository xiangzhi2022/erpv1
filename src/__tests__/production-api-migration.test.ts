import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';
const WORKER_ID = '33333333-3333-4333-8333-333333333333';

const reviewRouteLoaders = {
  approve: () => import('@/app/api/production/tasks/[id]/approve/route'),
  review: () => import('@/app/api/production/tasks/[id]/review/route'),
  rework: () => import('@/app/api/production/tasks/[id]/rework/route'),
  abnormal: () => import('@/app/api/production/tasks/[id]/abnormal/route'),
};

const workerTransitionRouteLoaders = {
  start: () => import('@/app/api/production/tasks/[id]/start/route'),
  submit: () => import('@/app/api/production/tasks/[id]/submit/route'),
};

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getEnterpriseContext: vi.fn(),
  requirePermission: vi.fn(),
  getSupabaseClient: vi.fn(),
  getUserFromRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  requirePermission: mocks.requirePermission,
}));
vi.mock('@/db/client', () => ({ getSupabaseClient: mocks.getSupabaseClient }));
vi.mock('@/lib/auth', () => ({ getUserFromRequest: mocks.getUserFromRequest }));

function emptyClient() {
  return {
    from() {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        or: vi.fn(() => query),
        range: vi.fn(() => query),
        order: vi.fn(() => query),
        in: vi.fn(() => query),
        then: <TResult1 = unknown, TResult2 = never>(
          onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) => Promise.resolve({ data: [], error: null, count: 0 }).then(onfulfilled, onrejected),
      };
      return query;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.getEnterpriseContext.mockResolvedValue({
    userId: 'user-1',
    enterpriseId: ENTERPRISE_ID,
    grants: new Set(['production.read']),
  });
  mocks.getUserFromRequest.mockResolvedValue({
    id: 'user-1',
    tenant_id: ENTERPRISE_ID,
    role: 'production_manager',
  });
  mocks.createClient.mockResolvedValue(emptyClient());
  mocks.getSupabaseClient.mockReturnValue(emptyClient());
});

describe('production API migration', () => {
  it('rejects malformed task-list pagination before querying production data', async () => {
    const { GET } = await import('@/app/api/production/tasks/route');

    const response = await GET(new Request('https://erp.example.com/api/production/tasks?page=not-a-number'));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ success: false, error: '请求参数校验失败' });
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'production.read');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('assigns through the enterprise-scoped atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: TASK_ID, status: 'assigned' }, error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    const { PATCH } = await import('@/app/api/production/tasks/[id]/assign/route');

    const response = await PATCH(new Request(`https://erp.example.com/api/production/tasks/${TASK_ID}/assign`, {
      method: 'PATCH', body: JSON.stringify({ assigned_worker_id: WORKER_ID }),
    }), { params: Promise.resolve({ id: TASK_ID }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: TASK_ID, status: 'assigned' } });
    expect(rpc).toHaveBeenCalledWith('assign_production_task', expect.objectContaining({
      p_enterprise_id: ENTERPRISE_ID, p_task_id: TASK_ID, p_assigned_worker_id: WORKER_ID,
    }));
  });

  it.each([
    ['approve', '/approve', { action: 'approve' }, 'approve'],
    ['review', '/review', { action: 'approve' }, 'approve'],
    ['rework', '/rework', { action: 'rework' }, 'rework'],
    ['abnormal', '/abnormal', { action: 'abnormal' }, 'abnormal'],
  ])('handles %s through the atomic review RPC', async (name, suffix, body, action) => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: TASK_ID, status: 'completed' }, error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    const routeHandler = await reviewRouteLoaders[name as keyof typeof reviewRouteLoaders]();

    const response = await routeHandler.PATCH(new Request(`https://erp.example.com/api/production/tasks/${TASK_ID}${suffix}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: TASK_ID }) });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('review_production_task', expect.objectContaining({
      p_enterprise_id: ENTERPRISE_ID, p_task_id: TASK_ID, p_action: action,
    }));
  });

  it('edits a task through the whitelist RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: TASK_ID, task_name: '切割' }, error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    const { PATCH } = await import('@/app/api/production/tasks/[id]/route');

    const response = await PATCH(new Request(`https://erp.example.com/api/production/tasks/${TASK_ID}`, {
      method: 'PATCH', body: JSON.stringify({ task_name: '切割' }),
    }), { params: Promise.resolve({ id: TASK_ID }) });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('edit_production_task', expect.objectContaining({
      p_enterprise_id: ENTERPRISE_ID, p_task_id: TASK_ID, p_fields: { task_name: '切割' },
    }));
  });

  it.each([
    ['start', 'producing'],
    ['submit', 'submitted'],
  ])('lets a worker %s only through the self-transition RPC', async (action, nextStatus) => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: TASK_ID, status: nextStatus }, error: null });
    mocks.createClient.mockResolvedValue({ rpc });
    const routeHandler = await workerTransitionRouteLoaders[action as keyof typeof workerTransitionRouteLoaders]();

    const response = await routeHandler.PATCH(new Request(`https://erp.example.com/api/production/tasks/${TASK_ID}/${action}`, { method: 'PATCH' }), {
      params: Promise.resolve({ id: TASK_ID }),
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('transition_own_production_task', expect.objectContaining({
      p_enterprise_id: ENTERPRISE_ID, p_task_id: TASK_ID, p_action: action,
    }));
  });
});
