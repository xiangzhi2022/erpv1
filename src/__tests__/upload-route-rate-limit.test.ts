import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api/errors';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enforceRateLimit: vi.fn(),
  getEnterpriseContext: vi.fn(),
  requirePermission: vi.fn(),
  requireSettingsUser: vi.fn(),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/app/api/settings/_utils', () => ({
  requireSettingsUser: mocks.requireSettingsUser,
  authFailed: (result: object) => 'response' in result,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockRejectedValue(
    ApiError.rateLimited('RATE_LIMITED', '请求过于频繁', 41),
  );
  mocks.getEnterpriseContext.mockResolvedValue({
    enterpriseId: ENTERPRISE_ID,
    userId: USER_ID,
    grants: new Set(['attachments.manage']),
  });
  mocks.requireSettingsUser.mockResolvedValue({
    user: { id: USER_ID, role: 'admin' },
    context: { enterpriseId: ENTERPRISE_ID, userId: USER_ID },
  });
});

describe('upload route rate limiting', () => {
  it('rejects an over-limit order attachment before parsing or storing the file', async () => {
    const request = new Request('https://erp.example.com/api/orders/attachments', {
      method: 'POST',
      headers: { 'x-request-id': 'order-upload-request' },
    });
    const formData = vi.spyOn(request, 'formData');
    const { POST } = await import('@/app/api/orders/attachments/route');

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('41');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('order-upload-request');
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: '请求过于频繁',
        requestId: 'order-upload-request',
      },
    });
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID }),
      'attachments.manage',
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      bucket: 'uploads.user',
      identifier: USER_ID,
      limit: 30,
      windowSeconds: 3600,
    });
    expect(formData).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects an over-limit avatar before parsing or storing the file', async () => {
    const request = new NextRequest('https://erp.example.com/api/settings/avatar', {
      method: 'POST',
      headers: { 'x-request-id': 'avatar-upload-request' },
    });
    const formData = vi.spyOn(request, 'formData');
    const { POST } = await import('@/app/api/settings/avatar/route');

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('41');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('avatar-upload-request');
    expect(mocks.requireSettingsUser).toHaveBeenCalledWith(request);
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID }),
      'settings.manage',
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      bucket: 'uploads.user',
      identifier: USER_ID,
      limit: 30,
      windowSeconds: 3600,
    });
    expect(formData).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
