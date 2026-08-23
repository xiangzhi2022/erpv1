import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createManagedIdentity: vi.fn(),
  findManagedIdentityByPhone: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/admin/user-identities', () => ({
  createManagedIdentity: mocks.createManagedIdentity,
  findManagedIdentityByPhone: mocks.findManagedIdentityByPhone,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mocks.from, rpc: mocks.rpc })),
}));

const context = {
  enterpriseId: '10000000-0000-4000-8000-000000000001',
  enterpriseName: '企业 A',
  enterpriseType: 'manufacturer' as const,
  permissions: new Set<string>(),
  roleCodes: [],
  membershipId: 'membership-1',
  userId: 'admin-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  const query = { eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn() };
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: 'membership-2', status: 'active' }, error: null });
  mocks.from.mockReturnValue(query);
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

describe('employee identity boundary', () => {
  it('rejects account creation/password input without any admin Auth lookup or write', async () => {
    const { createOrReuseEmployeeLoginUser } = await import('@/lib/employee-management');
    await expect(createOrReuseEmployeeLoginUser({
      create_account: true, phone: '13800138000', password: 'secret123',
    }, context)).rejects.toThrow(/加入申请/);
    expect(mocks.findManagedIdentityByPhone).not.toHaveBeenCalled();
    expect(mocks.createManagedIdentity).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('only accepts an explicit user id with active membership in the current enterprise', async () => {
    const { createOrReuseEmployeeLoginUser } = await import('@/lib/employee-management');
    await expect(createOrReuseEmployeeLoginUser({ user_id: '20000000-0000-4000-8000-000000000002' }, context))
      .resolves.toBe('20000000-0000-4000-8000-000000000002');
    const query = mocks.from.mock.results.at(-1)?.value;
    expect(query.eq).toHaveBeenCalledWith('tenant_id', context.enterpriseId);
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('rejects a cross-enterprise or inactive user id', async () => {
    const query = { eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn() };
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.from.mockReturnValue(query);
    const { createOrReuseEmployeeLoginUser } = await import('@/lib/employee-management');
    await expect(createOrReuseEmployeeLoginUser({ user_id: '20000000-0000-4000-8000-000000000099' }, context))
      .rejects.toThrow(/加入审批/);
  });

  it('replaces login role bindings only through the tenant-scoped RPC', async () => {
    const { syncEmployeeRoleBindings } = await import('@/lib/employee-management');
    await syncEmployeeRoleBindings('20000000-0000-4000-8000-000000000002', [{
      id: '30000000-0000-4000-8000-000000000003', code: 'worker', name: '员工',
      description: null, tenant_id: context.enterpriseId,
    }], context);
    expect(mocks.rpc).toHaveBeenCalledWith('replace_employee_role_bindings', {
      target_enterprise_id: context.enterpriseId,
      target_role_ids: ['30000000-0000-4000-8000-000000000003'],
      target_user_id: '20000000-0000-4000-8000-000000000002',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
