import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getSupabaseClient } from '@/db/client';
import { normalizeAccountRole, type PermissionKey } from '@/lib/role-access';

// ===================== 类型定义 =====================

export interface User {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  avatar?: string;
  provider?: 'credentials' | 'wechat' | 'github' | 'google';
  role?: string;
  tenant_id?: string;
  tenant_type?: string;
  department?: string;
  nickname?: string;
  permissions?: PermissionKey[];
}

export interface Session {
  user: User;
  expiresAt: number;
}

// ===================== 密码哈希 =====================

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, hashed: string): boolean {
  const [salt, derivedKey] = hashed.split(':');
  if (!salt || !derivedKey) return false;
  const candidateKey = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(candidateKey, 'hex'));
}

/**
 * 检测密码是否为明文（旧格式），用于向后兼容迁移
 */
export function isPlaintextPassword(stored: string): boolean {
  return !stored.includes(':');
}

// ===================== 内存存储（生产环境应替换为数据库）=====================

const globalAuthState = globalThis as typeof globalThis & {
  __erpCaptchaStore?: Map<string, { code: string; expiresAt: number }>;
  __erpResetTokenStore?: Map<string, { email: string; expiresAt: number }>;
  __erpOAuthStateStore?: Map<string, { provider: string; redirectUrl: string; expiresAt: number }>;
  __erpSessionStore?: Map<string, Session>;
};

// 验证码存储: captchaId -> { code, expiresAt }
const captchaStore = globalAuthState.__erpCaptchaStore ??= new Map<string, { code: string; expiresAt: number }>();

// 密码重置令牌: token -> { email, expiresAt }
const resetTokenStore = globalAuthState.__erpResetTokenStore ??= new Map<string, { email: string; expiresAt: number }>();

// OAuth state 存储: state -> { provider, redirectUrl, expiresAt }
const oauthStateStore = globalAuthState.__erpOAuthStateStore ??= new Map<string, { provider: string; redirectUrl: string; expiresAt: number }>();

// 会话存储: sessionId -> Session
const sessionStore = globalAuthState.__erpSessionStore ??= new Map<string, Session>();

// 用户存储（演示用，生产应替换为数据库）
const userStore = new Map<string, { password: string; user: User }>();

// Demo user IDs must be valid UUIDs to satisfy database UUID column constraints
// (e.g. users.id, work_orders.created_by, progress_logs.operator_id)
const DEMO_UUID_1 = '00000000-0000-0000-0000-000000000001';
const DEMO_UUID_2 = '00000000-0000-0000-0000-000000000002';

// 初始化演示用户（密码已哈希）
const DEMO_PASSWORD_HASH = hashPassword('demo123');
userStore.set('demo@example.com', {
  password: DEMO_PASSWORD_HASH,
  user: { id: DEMO_UUID_1, email: 'demo@example.com', name: '演示用户', provider: 'credentials' },
});
userStore.set('13800138000', {
  password: DEMO_PASSWORD_HASH,
  user: { id: DEMO_UUID_2, phone: '13800138000', name: '手机用户', provider: 'credentials' },
});

// ===================== 验证码相关 =====================

export function generateCaptchaId(code: string): string {
  const captchaId = crypto.randomUUID();
  captchaStore.set(captchaId, { code: code.toLowerCase(), expiresAt: Date.now() + 5 * 60 * 1000 });
  return captchaId;
}

export function verifyCaptcha(captchaId: string, code: string): boolean {
  const stored = captchaStore.get(captchaId);
  if (!stored) return false;
  captchaStore.delete(captchaId); // 一次性验证
  if (Date.now() > stored.expiresAt) return false;
  return stored.code === code.toLowerCase();
}

// ===================== 密码重置令牌 =====================

export function generateResetToken(email: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  resetTokenStore.set(token, { email, expiresAt: Date.now() + 30 * 60 * 1000 }); // 30 分钟有效
  return token;
}

export function verifyResetToken(token: string): string | null {
  const stored = resetTokenStore.get(token);
  if (!stored) return null;
  if (Date.now() > stored.expiresAt) {
    resetTokenStore.delete(token);
    return null;
  }
  return stored.email;
}

export function consumeResetToken(token: string): string | null {
  const email = verifyResetToken(token);
  if (email) resetTokenStore.delete(token);
  return email;
}

export function updateUserPassword(email: string, newPassword: string): boolean {
  const hashedPassword = hashPassword(newPassword);
  const existing = userStore.get(email);
  if (existing) {
    existing.password = hashedPassword;
    return true;
  }
  return false;
}

/**
 * 更新 Supabase 数据库中的用户密码
 */
export async function updateUserPasswordInDB(email: string, newPassword: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const hashedPassword = hashPassword(newPassword);
    const { error } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', email);

    return !error;
  } catch {
    return false;
  }
}

// ===================== OAuth State =====================

export function generateOAuthState(provider: string, redirectUrl: string): string {
  const state = crypto.randomBytes(16).toString('hex');
  oauthStateStore.set(state, { provider, redirectUrl, expiresAt: Date.now() + 10 * 60 * 1000 });
  return state;
}

export function verifyOAuthState(state: string): { provider: string; redirectUrl: string } | null {
  const stored = oauthStateStore.get(state);
  if (!stored) return null;
  if (Date.now() > stored.expiresAt) {
    oauthStateStore.delete(state);
    return null;
  }
  oauthStateStore.delete(state);
  return stored;
}

// ===================== 会话管理 =====================

export const SESSION_COOKIE_NAME = 'auth_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 天
const SESSION_DEFAULT_MAX_AGE = 7 * 24 * 60 * 60; // 7 天（秒）

export interface CookieOptions {
  maxAge?: number; // 秒
  secure?: boolean;
}

export function buildSessionCookie(sessionId: string, options: CookieOptions = {}): string {
  const maxAge = options.maxAge ?? SESSION_DEFAULT_MAX_AGE;
  const secure = options.secure ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function buildClearSessionCookie(secure = false): string {
  const secureFlag = secure ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
}

export function isProduction(): boolean {
  return process.env.COZE_PROJECT_ENV === 'PROD';
}

export async function createSession(user: User, maxAgeMs?: number): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const duration = maxAgeMs ?? SESSION_DURATION;
  const session: Session = { user, expiresAt: Date.now() + duration };
  sessionStore.set(sessionId, session);
  return sessionId;
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;
  const session = sessionStore.get(sessionId);
  if (!session || Date.now() > session.expiresAt) {
    sessionStore.delete(sessionId);
    return null;
  }
  return session;
}

export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

// ===================== 从请求中获取用户 =====================

export interface AuthUser extends User {
  role: string;
  tenant_id?: string;
  nickname?: string;
  tenant_type?: string;
  department?: string;
  permissions: PermissionKey[];
}

/**
 * Resolve role and tenant_id from the database when the session user
 * was created from the in-memory demo store (which lacks these fields).
 * Results are cached in-memory for the session lifetime.
 */
type UserMeta = {
  role: string;
  tenant_id?: string;
  nickname?: string;
  tenant_type?: string;
  department?: string;
  permissions: PermissionKey[];
};

const userMetaCache = new Map<string, UserMeta>();

async function loadUserPermissions(userId: string): Promise<PermissionKey[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('user_permissions')
      .select('permission_key')
      .eq('user_id', userId);

    if (error || !data) return [];
    return Array.from(
      new Set(
        data
          .map((row: { permission_key?: string | null }) => row.permission_key)
          .filter((key): key is PermissionKey => Boolean(key))
      )
    );
  } catch {
    return [];
  }
}

async function resolveUserMeta(user: User): Promise<UserMeta> {
  const cached = userMetaCache.get(user.id);
  if (cached) return cached;

  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('users')
      .select('role, tenant_id, tenant_type, real_name, nickname, department')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      let tenantType: string | undefined = data.tenant_type || undefined;
      if (data.tenant_id) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('tenant_type')
          .eq('id', data.tenant_id)
          .maybeSingle();
        tenantType = tenantData?.tenant_type || tenantType;
      }
      const permissions = await loadUserPermissions(user.id);

      const meta = {
        role: normalizeAccountRole(data.role || user.role || 'employee') === 'guest'
          ? 'employee'
          : normalizeAccountRole(data.role || user.role || 'employee'),
        tenant_id: data.tenant_id || undefined,
        nickname: data.real_name || data.nickname || undefined,
        tenant_type: tenantType,
        department: data.department || undefined,
        permissions,
      };
      userMetaCache.set(user.id, meta);
      return meta;
    }
  } catch {
    // DB not reachable - fall through to defaults.
  }

  return {
    role: normalizeAccountRole(user.role || 'employee') === 'guest'
      ? 'employee'
      : normalizeAccountRole(user.role || 'employee'),
    tenant_id: user.tenant_id,
    nickname: user.nickname || user.name,
    tenant_type: user.tenant_type,
    department: user.department,
    permissions: user.permissions || [],
  };
}

async function resolveSessionUser(sessionId: string | undefined): Promise<AuthUser | null> {
  if (!sessionId) return null;
  const session = sessionStore.get(sessionId);
  if (!session || Date.now() > session.expiresAt) {
    if (sessionId) sessionStore.delete(sessionId);
    return null;
  }

  const meta = await resolveUserMeta(session.user);
  return {
    ...session.user,
    role: meta.role,
    tenant_id: meta.tenant_id,
    nickname: meta.nickname || session.user.name,
    tenant_type: meta.tenant_type,
    department: meta.department,
    permissions: meta.permissions,
  };
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    return resolveSessionUser(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    return null;
  }
}

export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const sessionMatch = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    return resolveSessionUser(sessionMatch?.[1]);
  } catch {
    return null;
  }
}

// ===================== 用户认证 =====================

export type AuthFailureReason = 'account_not_found' | 'password_incorrect' | 'account_disabled' | 'auth_unavailable';

export type AuthCheckResult =
  | { success: true; user: User }
  | { success: false; reason: AuthFailureReason };

export function authenticateUserFromStore(account: string, password: string): User | null {
  const stored = userStore.get(account);
  if (!stored) return null;

  // 向后兼容：支持明文密码和哈希密码
  const passwordMatch = isPlaintextPassword(stored.password)
    ? stored.password === password
    : verifyPassword(password, stored.password);

  if (!passwordMatch) return null;

  // 如果是明文密码，自动升级为哈希密码
  if (isPlaintextPassword(stored.password)) {
    stored.password = hashPassword(password);
  }

  return stored.user;
}

export function authenticateUserFromStoreDetailed(account: string, password: string): AuthCheckResult {
  const stored = userStore.get(account);
  if (!stored) return { success: false, reason: 'account_not_found' };

  const passwordMatch = isPlaintextPassword(stored.password)
    ? stored.password === password
    : verifyPassword(password, stored.password);

  if (!passwordMatch) return { success: false, reason: 'password_incorrect' };

  if (isPlaintextPassword(stored.password)) {
    stored.password = hashPassword(password);
  }

  return { success: true, user: stored.user };
}

/**
 * 从 Supabase 数据库认证用户
 */
export async function authenticateUserFromDB(account: string, password: string): Promise<User | null> {
  try {
    const supabase = getSupabaseClient();
    const isPhone = /^1[3-9]\d{9}$/.test(account);
    if (!isPhone) return null;

    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, phone, real_name, nickname, avatar_url, password, role, is_active, tenant_id, tenant_type, department')
      .eq('phone', account)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !dbUser) return null;

    const passwordMatch = isPlaintextPassword(dbUser.password)
      ? dbUser.password === password
      : verifyPassword(password, dbUser.password);

    if (!passwordMatch) return null;

    if (isPlaintextPassword(dbUser.password)) {
      await supabase
        .from('users')
        .update({ password: hashPassword(password), updated_at: new Date().toISOString() })
        .eq('id', dbUser.id);
    }

    let tenantType: string | undefined = dbUser.tenant_type || undefined;
    if (dbUser.tenant_id) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('tenant_type')
        .eq('id', dbUser.tenant_id)
        .maybeSingle();
      tenantType = tenantData?.tenant_type || tenantType;
    }
    const permissions = await loadUserPermissions(dbUser.id);
    const normalizedRole = normalizeAccountRole(dbUser.role || 'employee');

    return {
      id: dbUser.id,
      phone: dbUser.phone || undefined,
      name: dbUser.real_name || dbUser.nickname || dbUser.phone || '用户',
      avatar: dbUser.avatar_url || undefined,
      provider: 'credentials',
      role: normalizedRole === 'guest' ? 'employee' : normalizedRole,
      tenant_id: dbUser.tenant_id || undefined,
      tenant_type: tenantType,
      department: dbUser.department || undefined,
      nickname: dbUser.real_name || dbUser.nickname || undefined,
      permissions,
    };
  } catch {
    return null;
  }
}

export async function authenticateUserFromDBDetailed(account: string, password: string): Promise<AuthCheckResult> {
  try {
    const supabase = getSupabaseClient();
    const isPhone = /^1[3-9]\d{9}$/.test(account);
    if (!isPhone) return { success: false, reason: 'account_not_found' };

    const { data: dbUser, error } = await supabase
      .from('users')
      .select('id, phone, real_name, nickname, avatar_url, password, role, is_active, tenant_id, tenant_type, department')
      .eq('phone', account)
      .maybeSingle();

    if (error) return { success: false, reason: 'auth_unavailable' };
    if (!dbUser) return { success: false, reason: 'account_not_found' };
    if (!dbUser.is_active) return { success: false, reason: 'account_disabled' };
    if (typeof dbUser.password !== 'string' || !dbUser.password) {
      return { success: false, reason: 'password_incorrect' };
    }

    const passwordMatch = isPlaintextPassword(dbUser.password)
      ? dbUser.password === password
      : verifyPassword(password, dbUser.password);

    if (!passwordMatch) return { success: false, reason: 'password_incorrect' };

    if (isPlaintextPassword(dbUser.password)) {
      await supabase
        .from('users')
        .update({ password: hashPassword(password), updated_at: new Date().toISOString() })
        .eq('id', dbUser.id);
    }

    let tenantType: string | undefined = dbUser.tenant_type || undefined;
    if (dbUser.tenant_id) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('tenant_type')
        .eq('id', dbUser.tenant_id)
        .maybeSingle();
      tenantType = tenantData?.tenant_type || tenantType;
    }
    const permissions = await loadUserPermissions(dbUser.id);
    const normalizedRole = normalizeAccountRole(dbUser.role || 'employee');

    return {
      success: true,
      user: {
        id: dbUser.id,
        phone: dbUser.phone || undefined,
        name: dbUser.real_name || dbUser.nickname || dbUser.phone || '用户',
        avatar: dbUser.avatar_url || undefined,
        provider: 'credentials',
        role: normalizedRole === 'guest' ? 'employee' : normalizedRole,
        tenant_id: dbUser.tenant_id || undefined,
        tenant_type: tenantType,
        department: dbUser.department || undefined,
        nickname: dbUser.real_name || dbUser.nickname || undefined,
        permissions,
      },
    };
  } catch {
    return { success: false, reason: 'auth_unavailable' };
  }
}

export async function authenticateUser(account: string, password: string): Promise<User | null> {
  // 1. 先查内存 store（演示用户等）
  const memoryUser = authenticateUserFromStore(account, password);
  if (memoryUser) return memoryUser;

  // 2. 再查 Supabase 数据库（正式注册用户）
  return authenticateUserFromDB(account, password);
}

export async function authenticateUserDetailed(account: string, password: string): Promise<AuthCheckResult> {
  const memoryResult = authenticateUserFromStoreDetailed(account, password);
  if (memoryResult.success || memoryResult.reason === 'password_incorrect') return memoryResult;
  return authenticateUserFromDBDetailed(account, password);
}

export function findOrCreateOAuthUser(provider: string, providerAccountId: string, profile: { name?: string; email?: string; avatar?: string }): User {
  // 演示：基于 provider + providerAccountId 生成唯一用户
  const userKey = `${provider}:${providerAccountId}`;
  const existing = userStore.get(userKey);
  if (existing) return existing.user;

  const user: User = {
    id: crypto.randomUUID(),
    name: profile.name || `${provider}用户`,
    email: profile.email,
    avatar: profile.avatar,
    provider: provider as User['provider'],
  };
  userStore.set(userKey, { password: '', user });
  return user;
}

// ===================== 定期清理过期数据 =====================

if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of captchaStore) {
      if (now > val.expiresAt) captchaStore.delete(key);
    }
    for (const [key, val] of resetTokenStore) {
      if (now > val.expiresAt) resetTokenStore.delete(key);
    }
    for (const [key, val] of oauthStateStore) {
      if (now > val.expiresAt) oauthStateStore.delete(key);
    }
    for (const [key, val] of sessionStore) {
      if (now > val.expiresAt) sessionStore.delete(key);
    }
  }, 60 * 1000);
}
