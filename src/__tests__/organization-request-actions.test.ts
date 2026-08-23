import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn(),
  getEnterpriseContext: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mocks.getClaims },
    from: mocks.from,
    rpc: mocks.rpc,
  })),
}));
vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  requirePermission: mocks.requirePermission,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { status: 'approved' }, error: null });
  mocks.getEnterpriseContext.mockResolvedValue({ enterpriseId: '10000000-0000-4000-8000-000000000001' });
});

describe('organization request identity boundary', () => {
  it('rejects self-service requests for privileged or arbitrary roles', async () => {
    const { POST } = await import('@/app/api/organization-requests/route');

    for (const requestedRoleCode of ['enterprise_owner', 'enterprise_admin', 'factory_admin']) {
      const response = await POST(new NextRequest('https://erp.example.com/api/organization-requests', {
        method: 'POST',
        body: JSON.stringify({
          enterprise_id: '10000000-0000-4000-8000-000000000001',
          requested_role_code: requestedRoleCode,
        }),
      }));
      expect(response.status).toBe(422);
    }
  });

  it('normalizes legacy employee requests to worker', async () => {
    const { POST } = await import('@/app/api/organization-requests/route');
    const response = await POST(new NextRequest('https://erp.example.com/api/organization-requests', {
      method: 'POST',
      body: JSON.stringify({
        enterprise_id: '10000000-0000-4000-8000-000000000001',
        requested_role_code: 'employee',
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith('create_enterprise_join_request', {
      target_enterprise_id: '10000000-0000-4000-8000-000000000001',
      target_message: null,
    });
  });

  it('lists only the caller requests by default and tenant pending requests for authorized managers', async () => {
    const { GET } = await import('@/app/api/organization-requests/route');
    await GET(new NextRequest('https://erp.example.com/api/organization-requests?status=pending'));
    expect(mocks.rpc).toHaveBeenLastCalledWith('list_enterprise_join_requests', {
      target_enterprise_id: null,
      target_status: 'pending',
    });

    await GET(new NextRequest('https://erp.example.com/api/organization-requests?scope=enterprise&status=pending'));
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), 'members.manage');
    expect(mocks.rpc).toHaveBeenLastCalledWith('list_enterprise_join_requests', {
      target_enterprise_id: '10000000-0000-4000-8000-000000000001',
      target_status: 'pending',
    });
  });

  it('handles approval atomically through the security definer RPC', async () => {
    const { PATCH } = await import('@/app/api/organization-requests/[id]/route');
    const response = await PATCH(new NextRequest('https://erp.example.com/api/organization-requests/request-1', {
      method: 'PATCH', body: JSON.stringify({ action: 'approve' }),
    }), { params: Promise.resolve({ id: '10000000-0000-4000-8000-000000000099' }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('handle_enterprise_join_request', {
      target_action: 'approve',
      target_reason: null,
      target_request_id: '10000000-0000-4000-8000-000000000099',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
