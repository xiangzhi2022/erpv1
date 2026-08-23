import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  class TestAuthServiceError extends Error {
    constructor(
      public readonly code: string,
      public readonly status: number,
      message: string,
    ) {
      super(message);
    }
  }

  return {
    TestAuthServiceError,
    completeEnterpriseOnboarding: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    requestPasswordReset: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    updatePassword: vi.fn(),
    verifyPhoneOtp: vi.fn(),
  };
});

vi.mock('@/lib/auth/service', () => ({
  AuthServiceError: mocks.TestAuthServiceError,
  createAuthService: vi.fn(async () => ({
    completeEnterpriseOnboarding: mocks.completeEnterpriseOnboarding,
    exchangeCodeForSession: mocks.exchangeCodeForSession,
    requestPasswordReset: mocks.requestPasswordReset,
    signInWithOAuth: mocks.signInWithOAuth,
    signInWithPassword: mocks.signInWithPassword,
    signOut: mocks.signOut,
    signUp: mocks.signUp,
    updatePassword: mocks.updatePassword,
    verifyPhoneOtp: mocks.verifyPhoneOtp,
  })),
  getApplicationUrl: () => 'https://erp.example.com',
  safeRedirectPath: (value: string | null | undefined) =>
    value?.startsWith('/') && !value.startsWith('//') ? value : '/orders',
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth API routes', () => {
  it('validates and delegates password login', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      user: { id: 'user-1' },
      session: { access_token: 'token' },
    });
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account: 'owner@example.com', password: 'secret12' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      account: 'owner@example.com',
      password: 'secret12',
    });
  });

  it('returns a stable error code without leaking Supabase errors', async () => {
    mocks.signInWithPassword.mockRejectedValue(
      new mocks.TestAuthServiceError('AUTH_UNAVAILABLE', 503, '认证服务暂时不可用'),
    );
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account: 'owner@example.com', password: 'secret12' }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: '认证服务暂时不可用',
      error_code: 'AUTH_UNAVAILABLE',
    });
  });

  it('signs out through Supabase Auth', async () => {
    mocks.signOut.mockResolvedValue(undefined);
    const { POST } = await import('@/app/api/auth/logout/route');
    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it('maps the existing registration form to Supabase signup and onboarding', async () => {
    mocks.signUp.mockResolvedValue({
      user: { id: 'user-1' },
      requiresVerification: false,
      enterpriseId: 'enterprise-1',
    });
    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          phone: '13800138000',
          password: 'secret12',
          companyName: '青崖家具',
          contactPerson: '王店长',
          tenantType: 'manufacturer',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.signUp).toHaveBeenCalledWith({
      account: '13800138000',
      password: 'secret12',
      displayName: '王店长',
      enterpriseName: '青崖家具',
      enterpriseType: 'manufacturer',
    });
  });

  it('completes onboarding after a separately verified signup', async () => {
    mocks.completeEnterpriseOnboarding.mockResolvedValue('enterprise-1');
    const { POST } = await import('@/app/api/auth/onboarding/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          displayName: '王店长',
          enterpriseName: '青崖家具',
          enterpriseType: 'manufacturer',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.completeEnterpriseOnboarding).toHaveBeenCalledWith({
      displayName: '王店长',
      enterpriseName: '青崖家具',
      enterpriseType: 'manufacturer',
    });
  });

  it('uses Supabase recovery without revealing whether an email exists', async () => {
    mocks.requestPasswordReset.mockResolvedValue(undefined);
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'owner@example.com' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: '如果该邮箱已注册，密码重置邮件已发送',
    });
  });

  it('updates the password only through the authenticated recovery session', async () => {
    mocks.updatePassword.mockResolvedValue({ id: 'user-1' });
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'new-secret12', confirmPassword: 'new-secret12' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updatePassword).toHaveBeenCalledWith('new-secret12');
  });

  it('verifies phone signup OTP through Supabase Auth', async () => {
    mocks.verifyPhoneOtp.mockResolvedValue(undefined);
    const { POST } = await import('@/app/api/auth/sms/verify/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/sms/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: '13800138000', code: '123456' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.verifyPhoneOtp).toHaveBeenCalledWith('13800138000', '123456');
  });

  it('uses Supabase OAuth and the PKCE confirmation callback', async () => {
    mocks.signInWithOAuth.mockResolvedValue('https://github.com/login/oauth/authorize');
    mocks.exchangeCodeForSession.mockResolvedValue(undefined);
    const { GET: startOAuth } = await import('@/app/api/auth/oauth/[provider]/route');
    const startResponse = await startOAuth(
      new NextRequest('https://erp.example.com/api/auth/oauth/github?redirect=%2Forders'),
      { params: Promise.resolve({ provider: 'github' }) },
    );
    expect(startResponse.headers.get('location')).toBe('https://github.com/login/oauth/authorize');

    const { GET: confirm } = await import('@/app/auth/confirm/route');
    const confirmResponse = await confirm(
      new NextRequest('https://erp.example.com/auth/confirm?code=pkce-code&next=%2Forders'),
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('pkce-code');
    expect(confirmResponse.headers.get('location')).toBe('https://erp.example.com/orders');
  });
});
