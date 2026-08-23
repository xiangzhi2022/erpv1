import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  canAccessPath: vi.fn(),
  getEnterpriseContext: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
}));
vi.mock('@/lib/enterprise/errors', () => ({
  isEnterpriseAccessError: (error: unknown) => (
    typeof error === 'object' && error !== null && 'code' in error
  ),
}));
vi.mock('@/lib/role-access', () => ({ canAccessPath: mocks.canAccessPath }));

import { ProtectedAppShell } from '@/components/protected-app-shell';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

describe('ProtectedAppShell', () => {
  it.each([
    ['IDENTITY_REQUIRED', '/login'],
    ['ENTERPRISE_SELECTION_REQUIRED', '/select-enterprise'],
    ['ENTERPRISE_MEMBERSHIP_REQUIRED', '/onboarding'],
    ['ENTERPRISE_ACCESS_FORBIDDEN', '/403'],
  ])('redirects %s before rendering protected content', async (code, destination) => {
    mocks.getEnterpriseContext.mockRejectedValue({ code });

    await expect(ProtectedAppShell({
      children: <div>private</div>,
      title: 'Protected',
      path: '/orders',
    })).rejects.toThrow(`REDIRECT:${destination}`);
    expect(mocks.canAccessPath).not.toHaveBeenCalled();
  });

  it('checks the current route grant and denies an authenticated user without access', async () => {
    const context = {
      enterpriseType: 'dealer',
      grants: new Set(['dashboard.read']),
    };
    mocks.getEnterpriseContext.mockResolvedValue(context);
    mocks.canAccessPath.mockReturnValue(false);

    await expect(ProtectedAppShell({
      children: <div>private</div>,
      title: 'Orders',
      path: '/orders',
    })).rejects.toThrow('REDIRECT:/403');
    expect(mocks.canAccessPath).toHaveBeenCalledWith({
      enterpriseType: context.enterpriseType,
      grants: context.grants,
    }, '/orders');
  });
});
