import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/db/database.types';

const auth = {
  exchangeCodeForSession: vi.fn(),
  getClaims: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
};

const rpc = vi.fn();
const adminRpc = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: adminRpc }),
}));

function membershipQuery(rows: Array<{ status: string }> = [{ status: 'active' }]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockResolvedValue({ data: rows, error: null });
  return query;
}

function makeClient(rows: Array<{ status: string }> = [{ status: 'active' }]) {
  return {
    auth,
    from: vi.fn(() => membershipQuery(rows)),
    rpc,
  } as unknown as SupabaseClient<Database>;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret-key-with-enough-entropy';
  auth.signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthService', () => {
  it.each([
    ['owner@example.com', { email: 'owner@example.com', password: 'secret12' }],
    ['13800138000', { phone: '13800138000', password: 'secret12' }],
  ])('delegates %s password login to Supabase Auth', async (account, credentials) => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
      error: null,
    });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient());

    const result = await service.signInWithPassword({ account, password: 'secret12' });

    expect(auth.signInWithPassword).toHaveBeenCalledWith(credentials);
    expect(result.user.id).toBe('user-1');
  });

  it('rejects an identity without an active enterprise membership', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
      error: null,
    });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient([{ status: 'suspended' }]));

    await expect(
      service.signInWithPassword({ account: 'owner@example.com', password: 'secret12' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'MEMBERSHIP_INACTIVE' }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('keeps a verified new identity signed in so onboarding can finish', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
      error: null,
    });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient([]));

    await expect(
      service.signInWithPassword({ account: 'owner@example.com', password: 'secret12' }),
    ).resolves.toMatchObject({ requiresOnboarding: true });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('detects an obfuscated duplicate signup response', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'existing', identities: [] }, session: null },
      error: null,
    });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient());

    await expect(
      service.signUp({
        account: 'owner@example.com',
        password: 'secret12',
        displayName: '王店长',
        enterpriseName: '青崖家具',
        enterpriseType: 'manufacturer',
      }),
    ).rejects.toEqual(expect.objectContaining({ code: 'IDENTITY_EXISTS' }));
  });

  it('atomically provisions the enterprise when signup returns a verified session', async () => {
    auth.signUp.mockResolvedValue({
      data: {
        user: { id: 'user-1', identities: [{ id: 'identity-1' }] },
        session: { access_token: 'token' },
      },
      error: null,
    });
    rpc.mockResolvedValue({ data: 'enterprise-1', error: null });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient());

    const result = await service.signUp({
      account: '13800138000',
      password: 'secret12',
      displayName: '王店长',
      enterpriseName: '青崖家具',
      enterpriseType: 'manufacturer',
    });

    expect(rpc).toHaveBeenCalledWith('onboard_enterprise', {
      display_name: '王店长',
      enterprise_name: '青崖家具',
      enterprise_type: 'manufacturer',
    });
    expect(result).toMatchObject({ enterpriseId: 'enterprise-1', requiresVerification: false });
  });

  it('uses Supabase recovery and session password update APIs', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    adminRpc.mockResolvedValue({ data: null, error: null });
    auth.updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient());

    await service.requestPasswordReset('owner@example.com', 'https://erp.example.com');
    await service.updatePassword('new-secret12');

    const resetOptions = auth.resetPasswordForEmail.mock.calls[0]?.[1] as { redirectTo: string };
    const resetUrl = new URL(resetOptions.redirectTo);
    expect(resetUrl.origin + resetUrl.pathname).toBe('https://erp.example.com/auth/confirm');
    expect(resetUrl.searchParams.get('next')).toBe('/reset-password');
    expect(resetUrl.searchParams.get('type')).toBe('recovery');
    expect(resetUrl.searchParams.get('flow')).toBeTruthy();
    expect(resetUrl.search).not.toContain('owner%40example.com');
    expect(adminRpc).toHaveBeenCalledWith('register_recovery_flow', expect.objectContaining({
      target_email_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      target_expires_at: expect.any(String),
      target_nonce_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-secret12' });
  });

  it('returns the verified callback user id after exchanging the PKCE code', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'recovery-user-1', email: 'owner@example.com' }, session: { access_token: 'token' } },
      error: null,
    });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient());

    await expect(service.exchangeCodeForSession('recovery-code')).resolves.toEqual({
      email: 'owner@example.com', userId: 'recovery-user-1',
    });
  });

  it('delegates email and phone OTP delivery and verification to Supabase Auth', async () => {
    auth.resend.mockResolvedValue({ data: {}, error: null });
    auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient());

    await service.sendEmailVerification('owner@example.com');
    await service.verifyEmailOtp('owner@example.com', '123456');
    await service.sendPhoneOtp('13800138000');
    await service.verifyPhoneOtp('13800138000', '654321');

    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'owner@example.com' });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '13800138000',
      options: { shouldCreateUser: false },
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'owner@example.com',
      token: '123456',
      type: 'email',
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      phone: '13800138000',
      token: '654321',
      type: 'sms',
    });
  });

  it('reauthenticates before changing a signed-in password', async () => {
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1', email: 'owner@example.com' } },
      error: null,
    });
    auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'token' } },
      error: null,
    });
    auth.updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient());

    await service.changePassword('current-secret', 'new-secret12');

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'current-secret',
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-secret12' });
  });

  it('allowlists OAuth providers and rejects unsafe redirects', async () => {
    auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'github', url: 'https://github.com/login/oauth/authorize' },
      error: null,
    });
    const { AuthService, safeRedirectPath } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient());

    expect(safeRedirectPath('https://evil.example/steal')).toBe('/orders');
    expect(safeRedirectPath('//evil.example/steal')).toBe('/orders');
    expect(safeRedirectPath('/finance/orders?state=open')).toBe('/finance/orders?state=open');
    await expect(service.signInWithOAuth('wechat', '/orders', 'https://erp.example.com')).rejects.toEqual(
      expect.objectContaining({ code: 'OAUTH_PROVIDER_UNSUPPORTED' }),
    );
    await service.signInWithOAuth('github', '/orders', 'https://erp.example.com');
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: {
        redirectTo: 'https://erp.example.com/auth/confirm?next=%2Forders',
        skipBrowserRedirect: true,
      },
    });
  });

  it('maps a Supabase outage without exposing provider details', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 503, message: 'upstream connection refused' },
    });
    const { AuthService } = await import('@/lib/auth/service');
    const service = new AuthService(makeClient());

    await expect(
      service.signInWithPassword({ account: 'owner@example.com', password: 'secret12' }),
    ).rejects.toEqual(expect.objectContaining({ code: 'AUTH_UNAVAILABLE' }));
  });
});

describe('authentication implementation invariants', () => {
  it('contains no process-memory identity, custom password, reset-token, or OAuth-state implementation', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8');

    expect(source).not.toMatch(/new Map|scrypt|timingSafeEqual|demo@example\.com/i);
    expect(source).not.toMatch(/generateResetToken|resetTokenStore|generateOAuthState|oauthStateStore/);
    expect(source).not.toMatch(/auth_session|sessionStore|captchaStore/);
  });
});
