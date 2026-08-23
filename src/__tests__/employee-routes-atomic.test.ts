import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createOrReuse: vi.fn(),
  ensureRoles: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  hasEnterprisePermission: vi.fn(),
}));

vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: vi.fn(async () => ({ enterpriseId: '10000000-0000-4000-8000-000000000001' })),
  hasEnterprisePermission: mocks.hasEnterprisePermission,
  requirePermission: vi.fn(),
}));
vi.mock('@/lib/employee-management', () => ({
  EmployeeIdentityConflict: class EmployeeIdentityConflict extends Error { readonly status = 409; },
  createOrReuseEmployeeLoginUser: mocks.createOrReuse,
  ensureEmployeeRoleRows: mocks.ensureRoles,
  stringArray: (value: unknown) => Array.isArray(value) ? value : [],
  text: (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mocks.from, rpc: mocks.rpc })),
}));

function query(result: unknown) {
  const builder = {
    eq: vi.fn(), maybeSingle: vi.fn(), select: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createOrReuse.mockResolvedValue(null);
  mocks.ensureRoles.mockResolvedValue([{ id: '30000000-0000-4000-8000-000000000003' }]);
  mocks.rpc.mockResolvedValue({ data: { id: 'employee-1' }, error: null });
  mocks.hasEnterprisePermission.mockReturnValue(false);
});

describe('employee atomic mutation routes', () => {
  it('creates the employee and all relations with one RPC and no duplicate primary-position field', async () => {
    const { POST } = await import('@/app/api/employees/route');
    const response = await POST(new NextRequest('https://erp.example.com/api/employees', {
      method: 'POST',
      body: JSON.stringify({
        employee_no: 'E001', name: '员工',
        primary_position_id: '40000000-0000-4000-8000-000000000004',
        position_ids: ['40000000-0000-4000-8000-000000000004'],
        role_ids: ['30000000-0000-4000-8000-000000000003'],
      }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    const [, args] = mocks.rpc.mock.calls[0];
    expect(mocks.rpc).toHaveBeenCalledWith('save_employee_with_relations', expect.any(Object));
    expect(args.target_primary_position_id).toBe('40000000-0000-4000-8000-000000000004');
    expect(args.target_fields).not.toHaveProperty('primary_position_id');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('preserves employee roles when changing user_id and atomically maps them to the new member', async () => {
    mocks.createOrReuse.mockResolvedValue('20000000-0000-4000-8000-000000000002');
    mocks.from.mockImplementation((table: string) => {
      if (table === 'employees') return query({ data: { id: 'employee-1', user_id: 'old-user', primary_position_id: null, status: 'active' }, error: null });
      if (table === 'employee_positions') return query({ data: [], error: null });
      return query({ data: [{ role: { id: '30000000-0000-4000-8000-000000000003' } }], error: null });
    });
    const { PATCH } = await import('@/app/api/employees/[id]/route');
    const response = await PATCH(new NextRequest('https://erp.example.com/api/employees/employee-1', {
      method: 'PATCH', body: JSON.stringify({
        user_id: '20000000-0000-4000-8000-000000000002',
        primary_position_id: '40000000-0000-4000-8000-000000000004',
      }),
    }), { params: Promise.resolve({ id: 'employee-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('save_employee_with_relations', expect.objectContaining({
      target_fields: expect.not.objectContaining({ primary_position_id: expect.anything() }),
      target_primary_position_id: '40000000-0000-4000-8000-000000000004',
      target_role_ids: ['30000000-0000-4000-8000-000000000003'],
      target_user_id: '20000000-0000-4000-8000-000000000002',
    }));
  });

  it('does not echo base salary to a members manager without enterprise wage-read permission', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'employees') return query({ data: { id: 'employee-1', user_id: null, primary_position_id: null, status: 'active' }, error: null });
      return query({ data: [], error: null });
    });
    mocks.rpc.mockResolvedValue({ data: { id: 'employee-1', name: '员工', base_salary: 4200 }, error: null });
    const { PATCH } = await import('@/app/api/employees/[id]/route');
    const response = await PATCH(new NextRequest('https://erp.example.com/api/employees/employee-1', {
      method: 'PATCH', body: JSON.stringify({ name: '员工' }),
    }), { params: Promise.resolve({ id: 'employee-1' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: 'employee-1', name: '员工' },
    });
  });

  it('deactivates or deletes an employee only through the access-revoking RPC', async () => {
    const { DELETE } = await import('@/app/api/employees/[id]/route');
    const response = await DELETE(new NextRequest('https://erp.example.com/api/employees/employee-1?hard=1', {
      method: 'DELETE',
    }), { params: Promise.resolve({ id: 'employee-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('delete_employee_with_access', {
      target_employee_id: 'employee-1',
      target_enterprise_id: '10000000-0000-4000-8000-000000000001',
      target_hard_delete: true,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
