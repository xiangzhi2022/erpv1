import type { AuthError, Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/db/database.types';
import { createClient } from '@/lib/supabase/server';
import {
  oauthProviderSchema,
  type LoginInput,
  type RegisterInput,
  type SupportedOAuthProvider,
} from './schemas';

export type AuthServiceErrorCode =
  | 'AUTH_UNAVAILABLE'
  | 'IDENTITY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REQUEST'
  | 'MEMBERSHIP_INACTIVE'
  | 'OAUTH_PROVIDER_UNSUPPORTED'
  | 'ONBOARDING_FAILED';

export class AuthServiceError extends Error {
  constructor(
    public readonly code: AuthServiceErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export interface SignInResult {
  user: User;
  session: Session;
  requiresOnboarding: boolean;
}

export interface SignUpResult {
  user: User;
  requiresVerification: boolean;
  enterpriseId: string | null;
}

function isEmail(account: string): boolean {
  return account.includes('@');
}

function providerError(error: AuthError | null, fallbackCode: AuthServiceErrorCode): never {
  if (error?.status && error.status >= 500) {
    throw new AuthServiceError('AUTH_UNAVAILABLE', 503, '认证服务暂时不可用');
  }
  if (error?.code === 'user_already_exists') {
    throw new AuthServiceError('IDENTITY_EXISTS', 409, '该账号已注册');
  }
  if (fallbackCode === 'INVALID_CREDENTIALS') {
    throw new AuthServiceError('INVALID_CREDENTIALS', 401, '账号或密码错误');
  }
  throw new AuthServiceError(fallbackCode, 400, '认证请求失败');
}

export function safeRedirectPath(value: string | null | undefined, fallback = '/orders'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const parsed = new URL(value, 'https://erp.invalid');
    return parsed.origin === 'https://erp.invalid'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

function authCallbackUrl(baseUrl: string, next: string): string {
  const callback = new URL('/auth/confirm', baseUrl);
  callback.searchParams.set('next', safeRedirectPath(next));
  return callback.toString();
}

export class AuthService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async signInWithPassword(input: LoginInput): Promise<SignInResult> {
    const credentials = isEmail(input.account)
      ? { email: input.account, password: input.password }
      : { phone: input.account, password: input.password };
    const { data, error } = await this.client.auth.signInWithPassword(credentials);

    if (error || !data.user || !data.session) providerError(error, 'INVALID_CREDENTIALS');

    const { data: memberships, error: membershipError } = await this.client
      .from('enterprise_memberships')
      .select('status')
      .eq('user_id', data.user.id);

    if (membershipError) {
      await this.client.auth.signOut();
      throw new AuthServiceError('AUTH_UNAVAILABLE', 503, '无法验证企业成员资格');
    }
    if (!memberships || memberships.length === 0) {
      return { user: data.user, session: data.session, requiresOnboarding: true };
    }
    if (!memberships.some((membership) => membership.status === 'active')) {
      await this.client.auth.signOut();
      throw new AuthServiceError('MEMBERSHIP_INACTIVE', 403, '账号未关联有效企业或成员资格已停用');
    }

    return { user: data.user, session: data.session, requiresOnboarding: false };
  }

  async signUp(input: RegisterInput): Promise<SignUpResult> {
    const credentials = isEmail(input.account)
      ? { email: input.account, password: input.password }
      : { phone: input.account, password: input.password };
    const { data, error } = await this.client.auth.signUp({
      ...credentials,
      options: {
        data: { display_name: input.displayName },
        emailRedirectTo: authCallbackUrl(getApplicationUrl(), '/onboarding'),
      },
    });

    if (error || !data.user) providerError(error, 'INVALID_REQUEST');
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new AuthServiceError('IDENTITY_EXISTS', 409, '该账号已注册');
    }

    if (!data.session) {
      return { user: data.user, requiresVerification: true, enterpriseId: null };
    }

    const enterpriseId = await this.completeEnterpriseOnboarding(input);

    return { user: data.user, requiresVerification: false, enterpriseId };
  }

  async completeEnterpriseOnboarding(
    input: Pick<RegisterInput, 'displayName' | 'enterpriseName' | 'enterpriseType'>,
  ): Promise<string> {
    const { data: enterpriseId, error: onboardingError } = await this.client.rpc(
      'onboard_enterprise',
      {
        display_name: input.displayName,
        enterprise_name: input.enterpriseName,
        enterprise_type: input.enterpriseType,
      },
    );
    if (onboardingError || !enterpriseId) {
      throw new AuthServiceError('ONBOARDING_FAILED', 500, '企业初始化失败');
    }
    return enterpriseId;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) providerError(error, 'AUTH_UNAVAILABLE');
  }

  async requestPasswordReset(email: string, baseUrl: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl(baseUrl, '/reset-password'),
    });
    if (error) providerError(error, 'AUTH_UNAVAILABLE');
  }

  async updatePassword(password: string): Promise<User> {
    const { data, error } = await this.client.auth.updateUser({ password });
    if (error || !data.user) providerError(error, 'INVALID_REQUEST');
    return data.user;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<User> {
    const { data: claimData, error: claimError } = await this.client.auth.getClaims();
    const claims = claimData?.claims;
    if (claimError || !claims?.sub) providerError(claimError, 'INVALID_CREDENTIALS');

    const email = typeof claims.email === 'string' ? claims.email : undefined;
    const phone = typeof claims.phone === 'string' ? claims.phone : undefined;
    if (!email && !phone) {
      throw new AuthServiceError('INVALID_CREDENTIALS', 401, '当前账号无法重新验证');
    }

    const { error: signInError } = await this.client.auth.signInWithPassword(
      email
        ? { email, password: currentPassword }
        : { phone: phone as string, password: currentPassword },
    );
    if (signInError) providerError(signInError, 'INVALID_CREDENTIALS');
    return this.updatePassword(newPassword);
  }

  async signInWithOAuth(
    providerValue: string,
    next: string | null,
    baseUrl: string,
  ): Promise<string> {
    const parsedProvider = oauthProviderSchema.safeParse(providerValue);
    if (!parsedProvider.success) {
      throw new AuthServiceError(
        'OAUTH_PROVIDER_UNSUPPORTED',
        400,
        '不支持的 OAuth 提供商',
      );
    }
    const provider: SupportedOAuthProvider = parsedProvider.data;
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authCallbackUrl(baseUrl, safeRedirectPath(next)),
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) providerError(error, 'AUTH_UNAVAILABLE');
    return data.url;
  }

  async exchangeCodeForSession(code: string): Promise<void> {
    const { error } = await this.client.auth.exchangeCodeForSession(code);
    if (error) providerError(error, 'INVALID_REQUEST');
  }

  async sendEmailVerification(email: string): Promise<void> {
    const { error } = await this.client.auth.resend({ type: 'signup', email });
    if (error) providerError(error, 'AUTH_UNAVAILABLE');
  }

  async verifyEmailOtp(email: string, token: string): Promise<void> {
    const { error } = await this.client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) providerError(error, 'INVALID_REQUEST');
  }

  async sendPhoneOtp(phone: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: false },
    });
    if (error) providerError(error, 'AUTH_UNAVAILABLE');
  }

  async verifyPhoneOtp(phone: string, token: string): Promise<void> {
    const { error } = await this.client.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) providerError(error, 'INVALID_REQUEST');
  }
}

export async function createAuthService(): Promise<AuthService> {
  return new AuthService(await createClient());
}

export function getApplicationUrl(): string {
  return (
    process.env.APP_URL
    || process.env.DEPLOY_PRIME_URL
    || process.env.URL
    || 'http://localhost:3000'
  ).replace(/\/$/, '');
}
