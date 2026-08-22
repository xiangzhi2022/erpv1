/**
 * 统一 Supabase 客户端模块
 *
 * 导出两个入口：
 *   - getSupabaseServiceClient()  — 服务端管理权限（secret key），绕过 RLS
 *   - getSupabaseClient(token?)   — 匿名/用户级客户端，可传入用户 token
 *
 * 环境变量：NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY、
 * SUPABASE_SECRET_KEY
 * 明确拒绝 localhost / 127.0.0.1 / ::1 / *.local 的 Supabase URL
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

// ── 环境变量加载状态 ──────────────────────────────────────────
let envLoaded = false;

// ── 本地 URL 黑名单 ──────────────────────────────────────────
const LOCAL_HOST_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost\b/i,
  /^https?:\/\/127\.0\.0\.1\b/i,
  /^https?:\/\/\[\s*::1\s*\]/i,
  /\.local\b/i,
];

function isLocalUrl(url: string): boolean {
  return LOCAL_HOST_PATTERNS.some((p) => p.test(url));
}

// ── 环境变量加载 ──────────────────────────────────────────────

/**
 * 加载 Supabase 环境变量。
 * 优先使用已注入的 process.env，其次加载 .env.local 和 .env。
 */
function loadEnv(): void {
  if (envLoaded) return;

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    envLoaded = true;
    return;
  }

  try {
    loadDotenv({ path: ['.env.local', '.env'], quiet: true });
  } catch {
    // dotenv 不可用
  }
  envLoaded = true;
}

// ── 统一环境变量读取 ──────────────────────────────────────────

interface SupabaseCredentials {
  url: string;
  publishableKey: string;
  secretKey?: string;
}

/**
 * 获取 Supabase 凭证。
 * 读取 Supabase 官方环境变量。
 * 拒绝 localhost 类 URL。
 */
function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. ' +
        'Please configure your cloud Supabase credentials.'
    );
  }
  if (!publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set. ' +
        'Please configure your cloud Supabase credentials.'
    );
  }

  // 明确拒绝本地 URL
  if (isLocalUrl(url)) {
    throw new Error(
      `Local Supabase URL is not supported: "${url}". ` +
        'This project requires a cloud Supabase instance.'
    );
  }

  return { url, publishableKey, secretKey };
}

// ── 客户端工厂 ────────────────────────────────────────────────

/**
 * 服务端管理权限客户端。
 * 必须存在 secret key，否则抛出明确错误。
 * 使用 secret key 绕过 RLS，用于服务端管理操作。
 */
function getSupabaseServiceClient(): SupabaseClient {
  const { url, secretKey } = getSupabaseCredentials();

  if (!secretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY is required ' +
        'for service-level operations. Server-side admin actions cannot proceed without it.'
    );
  }

  return createClient(url, secretKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 匿名/用户级客户端。
 * - 始终使用 publishable key
 * - 传入 token 时附加用户 Authorization header
 */
function getSupabaseClient(token?: string): SupabaseClient {
  const { url, publishableKey } = getSupabaseCredentials();

  const globalOptions: Record<string, unknown> = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }
  return createClient(url, publishableKey, {
    global: globalOptions,
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { loadEnv, getSupabaseCredentials, getSupabaseServiceClient, getSupabaseClient };
