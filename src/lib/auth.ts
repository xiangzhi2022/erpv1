import { cookies } from 'next/headers';
import crypto from 'crypto';

// ===================== 类型定义 =====================

export interface User {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  avatar?: string;
  provider?: 'credentials' | 'wechat' | 'github' | 'google';
}

export interface Session {
  user: User;
  expiresAt: number;
}

// ===================== 内存存储（生产环境应替换为数据库）=====================

// 验证码存储: captchaId -> { code, expiresAt }
const captchaStore = new Map<string, { code: string; expiresAt: number }>();

// 密码重置令牌: token -> { email, expiresAt }
const resetTokenStore = new Map<string, { email: string; expiresAt: number }>();

// OAuth state 存储: state -> { provider, redirectUrl, expiresAt }
const oauthStateStore = new Map<string, { provider: string; redirectUrl: string; expiresAt: number }>();

// 会话存储: sessionId -> Session
const sessionStore = new Map<string, Session>();

// 用户存储（演示用，生产应替换为数据库）
const userStore = new Map<string, { password: string; user: User }>();

// 初始化演示用户
userStore.set('demo@example.com', {
  password: 'demo123',
  user: { id: '1', email: 'demo@example.com', name: '演示用户', provider: 'credentials' },
});
userStore.set('13800138000', {
  password: 'demo123',
  user: { id: '2', phone: '13800138000', name: '手机用户', provider: 'credentials' },
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
  const existing = userStore.get(email);
  if (!existing) return false;
  existing.password = newPassword;
  return true;
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

const SESSION_COOKIE_NAME = 'auth_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 天

export async function createSession(user: User): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const session: Session = { user, expiresAt: Date.now() + SESSION_DURATION };
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

export function setSessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_DURATION / 1000)}`;
}

// ===================== 从请求中获取用户 =====================

export interface AuthUser extends User {
  role: string;
  tenant_id?: string;
  nickname?: string;
}

export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const sessionMatch = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (!sessionMatch) return null;
    const session = sessionStore.get(sessionMatch[1]);
    if (!session || Date.now() > session.expiresAt) return null;
    // 从用户信息推导角色（演示用：默认 super_admin）
    return { ...session.user, role: 'super_admin' };
  } catch {
    return null;
  }
}

// ===================== 用户认证 =====================

export function authenticateUser(account: string, password: string): User | null {
  const stored = userStore.get(account);
  if (!stored) return null;
  if (stored.password !== password) return null;
  return stored.user;
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
