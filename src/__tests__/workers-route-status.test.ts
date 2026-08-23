import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENTERPRISE_ID = '85000000-0000-4000-8000-000000000001';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getEnterpriseContext: vi.fn(),
  requirePermission: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  requirePermission: mocks.requirePermission,
}));

function createWorkersClient() {
  return {
    from: vi.fn(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        insert: mocks.insert,
      };
      return query;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getEnterpriseContext.mockResolvedValue({
    userId: '85000000-0000-4000-8000-000000000011',
    enterpriseId: ENTERPRISE_ID,
    grants: new Set(['members.manage']),
  });
  mocks.insert.mockImplementation((payload: Record<string, unknown>) => {
    const result = {
      data: { ...payload, id: '85000000-0000-4000-8000-000000000601', workshops: null },
      error: null,
    };
    const selectQuery = {
      select: vi.fn(() => selectQuery),
      single: vi.fn(async () => result),
    };
    return selectQuery;
  });
  mocks.createClient.mockResolvedValue(createWorkersClient());
});

describe('workers route status contract', () => {
  it('accepts a database worker status without writing protected identity fields', async () => {
    const { POST } = await import('@/app/api/workers/route');
    const response = await POST(new Request('https://erp.example.com/api/workers', {
      method: 'POST',
      body: JSON.stringify({ worker_no: 'WORKER-001', name: '工人甲', status: 'inactive' }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'members.manage');
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      enterprise_id: ENTERPRISE_ID,
      worker_no: 'WORKER-001',
      name: '工人甲',
      status: 'inactive',
    }));
    expect(mocks.insert.mock.calls[0]?.[0]).not.toHaveProperty('id');
    expect(mocks.insert.mock.calls[0]?.[0]).not.toHaveProperty('user_id');
    expect(mocks.insert.mock.calls[0]?.[0]).not.toHaveProperty('created_by');
    expect(mocks.insert.mock.calls[0]?.[0]).not.toHaveProperty('created_at');
  });

  it('rejects a legacy status before issuing a worker insert', async () => {
    const { POST } = await import('@/app/api/workers/route');
    const response = await POST(new Request('https://erp.example.com/api/workers', {
      method: 'POST',
      body: JSON.stringify({ worker_no: 'WORKER-002', name: '工人乙', status: 'on_leave' }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
