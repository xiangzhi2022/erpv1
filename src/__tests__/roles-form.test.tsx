import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesForm } from '@/app/settings/components/roles-form';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/settings/roles') {
      return Response.json({
        success: true,
        accountRoles: [
          { value: 'super_admin', label: '平台管理员', department: '平台', description: '平台管理账号' },
          { value: 'employee', label: '员工', department: '员工', description: '员工账号' },
        ],
        permissions: [],
      });
    }
    if (url === '/api/settings/users') {
      return Response.json({
        success: true,
        users: [
          { id: 'admin-1', phone: '13800000001', real_name: '管理员甲', role: 'super_admin', department: '平台', status: 'active' },
          { id: 'employee-1', phone: '13800000002', real_name: '员工乙', role: 'employee', department: '生产', status: 'active' },
        ],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('RolesForm', () => {
  it('filters users by the localized role label after role templates load', async () => {
    render(<RolesForm />);

    expect(await screen.findByText('管理员甲')).toBeInTheDocument();
    expect(screen.getByText('员工乙')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索手机号、姓名、权限...'), {
      target: { value: '平台管理员' },
    });

    expect(screen.getByText('管理员甲')).toBeInTheDocument();
    expect(screen.queryByText('员工乙')).not.toBeInTheDocument();
  });
});
