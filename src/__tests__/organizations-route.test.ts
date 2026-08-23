import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const IDEMPOTENCY_KEY = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  order: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  ACTIVE_TENANT_COOKIE_NAME: 'erp_active_enterprise',
  isProduction: () => false,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mocks.getClaims },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ order: mocks.order })),
      })),
    })),
    rpc: mocks.rpc,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null });
  mocks.order.mockResolvedValue({ data: [], error: null });
});

describe('organizations API', () => {
  it('lists only active enterprise memberships', async () => {
    mocks.order.mockResolvedValue({
      data: [
        {
          id: 'membership-1',
          tenant_id: ENTERPRISE_ID,
          display_name: '王店长',
          status: 'active',
          enterprise: {
            id: ENTERPRISE_ID,
            name: '青崖家具',
            enterprise_type: 'manufacturer',
            status: 'active',
          },
        },
        {
          id: 'membership-2',
          tenant_id: '33333333-3333-4333-8333-333333333333',
          display_name: '停用账号',
          status: 'suspended',
          enterprise: {
            id: '33333333-3333-4333-8333-333333333333',
            name: '停用企业',
            enterprise_type: 'dealer',
            status: 'active',
          },
        },
      ],
      error: null,
    });
    const { GET } = await import('@/app/api/organizations/route');
    const response = await GET(new NextRequest('https://erp.example.com/api/organizations'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      activeEnterpriseId: ENTERPRISE_ID,
      organizations: [{ enterpriseId: ENTERPRISE_ID, enterpriseName: '青崖家具' }],
    });
  });

  it('requires a UUID idempotency key before attempting a switch', async () => {
    const { POST } = await import('@/app/api/organizations/route');
    const response = await POST(new NextRequest('https://erp.example.com/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ enterpriseId: ENTERPRISE_ID, idempotencyKey: 'not-a-uuid' }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('sets the HttpOnly cookie only after the database authorizes the switch', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [{ allowed: true, tenant_id: ENTERPRISE_ID, membership_id: 'membership-1' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ permission: 'orders.read', scope_kind: 'enterprise', site_ids: [], workshop_ids: [] }],
        error: null,
      });
    const { POST } = await import('@/app/api/organizations/route');
    const response = await POST(new NextRequest('https://erp.example.com/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ enterpriseId: ENTERPRISE_ID, idempotencyKey: IDEMPOTENCY_KEY }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'authorize_enterprise_selection', expect.objectContaining({
      target_enterprise_id: ENTERPRISE_ID,
      target_idempotency_key: IDEMPOTENCY_KEY,
    }));
    expect(response.headers.get('set-cookie')).toContain(`erp_active_enterprise=${ENTERPRISE_ID}`);
    await expect(response.json()).resolves.toMatchObject({ redirectTo: '/orders' });
  });

  it('does not set a cookie when the database denies the switch', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ allowed: false, tenant_id: null, membership_id: null }],
      error: null,
    });
    const { POST } = await import('@/app/api/organizations/route');
    const response = await POST(new NextRequest('https://erp.example.com/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ enterpriseId: ENTERPRISE_ID, idempotencyKey: IDEMPOTENCY_KEY }),
    }));

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
