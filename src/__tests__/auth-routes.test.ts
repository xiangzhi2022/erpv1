import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api/errors';

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
    enforceRateLimit: vi.fn(),
    getClaims: vi.fn(),
    requestPasswordReset: vi.fn(),
    requireTrustedClientIp: vi.fn(),
    sendEmailVerification: vi.fn(),
    sendPhoneOtp: vi.fn(),
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
    sendEmailVerification: mocks.sendEmailVerification,
    sendPhoneOtp: mocks.sendPhoneOtp,
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

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  requireTrustedClientIp: mocks.requireTrustedClientIp,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mocks.getClaims },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enforceRateLimit.mockReset().mockResolvedValue({
    allowed: true,
    remaining: 1,
    retryAfterSeconds: 0,
  });
  mocks.getClaims.mockReset().mockResolvedValue({
    data: { claims: { sub: 'recovery-user-1' } },
    error: null,
  });
  mocks.requireTrustedClientIp.mockReset().mockReturnValue('192.0.2.10');
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
        body: JSON.stringify({ account: ' Owner@Example.COM ', password: 'secret12' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      account: 'Owner@Example.COM',
      password: 'secret12',
    });
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(1, {
      bucket: 'auth.login.ip',
      identifier: '192.0.2.10',
      limit: 10,
      windowSeconds: 900,
    });
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(2, {
      bucket: 'auth.login.account',
      identifier: 'Owner@Example.COM',
      identifierKind: 'account',
      limit: 10,
      windowSeconds: 900,
    });
  });

  it('returns the uniform 429 contract before attempting password login', async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(
      ApiError.rateLimited('RATE_LIMITED', '请求过于频繁', 37),
    );
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/login', {
        method: 'POST',
        headers: { 'x-request-id': 'auth-rate-test' },
        body: '{malformed-json',
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('37');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('auth-rate-test');
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: '请求过于频繁',
        requestId: 'auth-rate-test',
      },
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).toHaveBeenCalledOnce();
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      bucket: 'auth.login.ip',
    }));
  });

  it('consumes the login IP bucket before rejecting malformed JSON', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/login', {
        method: 'POST',
        body: '{malformed-json',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_JSON' },
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledOnce();
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      bucket: 'auth.login.ip',
      identifier: '192.0.2.10',
      limit: 10,
      windowSeconds: 900,
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('does not attempt password login when the account limiter rejects', async () => {
    mocks.enforceRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 9, retryAfterSeconds: 0 })
      .mockRejectedValueOnce(ApiError.rateLimited('RATE_LIMITED', '请求过于频繁', 21));
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account: 'Owner@Example.COM', password: 'secret12' }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('21');
    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(2, {
      bucket: 'auth.login.account',
      identifier: 'Owner@Example.COM',
      identifierKind: 'account',
      limit: 10,
      windowSeconds: 900,
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
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
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      bucket: 'auth.register.ip',
      identifier: '192.0.2.10',
      limit: 5,
      windowSeconds: 3600,
    });
  });

  it('consumes the registration IP bucket before reading malformed JSON', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/register', {
        method: 'POST',
        body: '{malformed-json',
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.enforceRateLimit).toHaveBeenCalledOnce();
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      bucket: 'auth.register.ip',
      identifier: '192.0.2.10',
      limit: 5,
      windowSeconds: 3600,
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('does not read registration JSON or call signup when the IP limiter rejects', async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(
      ApiError.rateLimited('RATE_LIMITED', '请求过于频繁', 18),
    );
    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/register', {
        method: 'POST',
        body: '{malformed-json',
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('18');
    expect(mocks.signUp).not.toHaveBeenCalled();
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
        body: JSON.stringify({ email: ' Owner@Example.COM ' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: '如果该邮箱已注册，密码重置邮件已发送',
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      bucket: 'auth.forgot-password.account',
      identifier: 'owner@example.com',
      limit: 5,
      windowSeconds: 3600,
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
    expect(mocks.getClaims).toHaveBeenCalledOnce();
    expect(mocks.updatePassword).toHaveBeenCalledWith('new-secret12');
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      bucket: 'auth.reset-password.user',
      identifier: 'recovery-user-1',
      limit: 5,
      windowSeconds: 3600,
    });
  });

  it('does not update a password when the recovery-user limiter rejects', async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(
      ApiError.rateLimited('RATE_LIMITED', '请求过于频繁', 12),
    );
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ password: 'new-secret12', confirmPassword: 'new-secret12' }),
      }),
    );

    expect(response.status).toBe(429);
    expect(mocks.updatePassword).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      identifier: 'recovery-user-1',
    }));
    expect(JSON.stringify(mocks.enforceRateLimit.mock.calls)).not.toContain('new-secret12');
  });

  it('requires a verified recovery identity before rate limiting password updates', async () => {
    mocks.getClaims.mockResolvedValueOnce({ data: { claims: {} }, error: null });
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const response = await POST(
      new NextRequest('https://erp.example.com/api/auth/reset-password', {
        method: 'POST',
        headers: { 'x-request-id': 'recovery-required-test' },
        body: JSON.stringify({ password: 'new-secret12', confirmPassword: 'new-secret12' }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'RECOVERY_SESSION_REQUIRED',
        message: '请先完成密码恢复验证',
        requestId: 'recovery-required-test',
      },
    });
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  it('rate-limits email and SMS sends by canonical destination', async () => {
    mocks.sendEmailVerification.mockResolvedValue(undefined);
    const { POST: sendEmail } = await import('@/app/api/auth/email/send/route');
    const emailResponse = await sendEmail(
      new NextRequest('https://erp.example.com/api/auth/email/send', {
        method: 'POST',
        body: JSON.stringify({ email: ' Owner@Example.COM ' }),
      }),
    );

    expect(emailResponse.status).toBe(200);
    expect(mocks.enforceRateLimit).toHaveBeenLastCalledWith({
      bucket: 'auth.email.send.destination',
      identifier: 'owner@example.com',
      limit: 5,
      windowSeconds: 3600,
    });

    mocks.sendPhoneOtp.mockResolvedValue(undefined);
    const { POST: sendSms } = await import('@/app/api/auth/sms/send/route');
    const smsResponse = await sendSms(
      new NextRequest('https://erp.example.com/api/auth/sms/send', {
        method: 'POST',
        body: JSON.stringify({ phone: '13800138000' }),
      }),
    );

    expect(smsResponse.status).toBe(200);
    expect(mocks.enforceRateLimit).toHaveBeenLastCalledWith({
      bucket: 'auth.sms.send.destination',
      identifier: '13800138000',
      limit: 5,
      windowSeconds: 3600,
    });
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
