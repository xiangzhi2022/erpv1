import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createManagedIdentity: vi.fn(),
  findManagedIdentityByPhone: vi.fn(),
  insert: vi.fn(),
  requireSettingsUser: vi.fn(),
  updateManagedIdentityPassword: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/app/api/settings/_utils', () => ({
  authFailed: (result: object) => 'response' in result,
  requireSettingsUser: mocks.requireSettingsUser,
}));

vi.mock('@/lib/admin/user-identities', () => ({
  createManagedIdentity: mocks.createManagedIdentity,
  findManagedIdentityByPhone: mocks.findManagedIdentityByPhone,
  updateManagedIdentityPassword: mocks.updateManagedIdentityPassword,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSettingsUser.mockResolvedValue({
    user: { id: 'admin-user', role: 'admin' },
    context: {
      enterpriseId: '10000000-0000-4000-8000-000000000001',
      enterpriseName: '企业 A',
      enterpriseType: 'manufacturer',
    },
  });

  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    insert: mocks.insert,
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    update: mocks.update,
    upsert: mocks.upsert,
  };
  query.delete.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.upsert.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({
    data: { id: 'role-worker', code: 'worker', name: '员工' },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: { user_id: 'member-user' }, error: null });
  mocks.createClient.mockResolvedValue({ from: vi.fn(() => query), rpc: mocks.rpc });
});

describe('settings user identity boundary', () => {
  it('does not attach an existing global Auth identity to another enterprise by phone', async () => {
    mocks.findManagedIdentityByPhone.mockResolvedValue({
      identity: { id: 'identity-owned-by-enterprise-b', phone: '13800138000' },
      error: null,
    });
    const { POST } = await import('@/app/api/settings/users/route');

    const response = await POST(new NextRequest('https://erp.example.com/api/settings/users', {
      method: 'POST',
      body: JSON.stringify({
        phone: '13800138000',
        password: 'new-secret12',
        real_name: '跨企业账号',
        role: 'worker',
      }),
    }));

    expect(response.status).toBe(409);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.createManagedIdentity).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateManagedIdentityPassword).not.toHaveBeenCalled();
  });

  it('does not create a new global Auth identity even when the phone is unused', async () => {
    const { POST } = await import('@/app/api/settings/users/route');
    const response = await POST(new NextRequest('https://erp.example.com/api/settings/users', {
      method: 'POST',
      body: JSON.stringify({ phone: '13900139000', password: 'new-secret12', role: 'worker' }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('加入申请') });
    expect(mocks.findManagedIdentityByPhone).not.toHaveBeenCalled();
    expect(mocks.createManagedIdentity).not.toHaveBeenCalled();
  });

  it('updates a tenant member through the atomic RPC instead of direct table writes', async () => {
    const { PUT } = await import('@/app/api/settings/users/route');
    const response = await PUT(new NextRequest(
      'https://erp.example.com/api/settings/users?id=20000000-0000-4000-8000-000000000002',
      { method: 'PUT', body: JSON.stringify({ real_name: '新姓名', status: 'active', role: 'worker' }) },
    ));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('update_enterprise_member', expect.objectContaining({
      target_enterprise_id: '10000000-0000-4000-8000-000000000001',
      target_user_id: '20000000-0000-4000-8000-000000000002',
      target_display_name: '新姓名',
      target_status: 'active',
      target_role_id: 'role-worker',
    }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects administrator password updates before any enterprise or Auth write', async () => {
    const { PUT } = await import('@/app/api/settings/users/route');

    const response = await PUT(new NextRequest(
      'https://erp.example.com/api/settings/users?id=identity-owned-by-enterprise-b',
      {
        method: 'PUT',
        headers: { 'x-request-id': 'member-password-rejected' },
        body: JSON.stringify({ password: 'replacement-secret12' }),
      },
    ));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'VALIDATION_FAILED',
        requestId: 'member-password-rejected',
      },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateManagedIdentityPassword).not.toHaveBeenCalled();
  });
});
