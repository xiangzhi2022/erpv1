/**
 * 统一 Supabase 客户端模块
 *
 * 导出两个入口：
 *   - getSupabaseServiceClient()  — 服务端管理权限（service_role_key），绕过 RLS
 *   - getSupabaseClient(token?)   — 匿名/用户级客户端，可传入用户 token
 *
 * 环境变量优先级：COZE_SUPABASE_* > SUPABASE_*（legacy 兼容）
 * 明确拒绝 localhost / 127.0.0.1 / ::1 / *.local 的 Supabase URL
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { getReportBuffer, createWrappedFetch } from 'coze-coding-dev-sdk';
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
 * 优先使用已注入的 process.env，其次尝试 dotenv，最后尝试 coze_workload_identity。
 */
function loadEnv(): void {
  if (envLoaded) return;

  // 如果 COZE_* 已存在则直接返回
  if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
    envLoaded = true;
    return;
  }

  // 尝试 dotenv
  try {
    loadDotenv();
    if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
      envLoaded = true;
      return;
    }
  } catch {
    // dotenv 不可用
  }

  // 尝试 coze_workload_identity
  try {
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;
    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if (
          (value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // 静默失败
  }
}

// ── 统一环境变量读取 ──────────────────────────────────────────

interface SupabaseCredentials {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

function isReportClientConfigured(): boolean {
  return Boolean(process.env.COZE_INTEGRATION_BASE_URL && process.env.COZE_WORKLOAD_IDENTITY_API_KEY);
}

function getSupabaseReportFetch(label: string): typeof fetch | undefined {
  if (!isReportClientConfigured()) return undefined;

  try {
    const buffer = getReportBuffer();
    return buffer ? createWrappedFetch(buffer, label) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 获取 Supabase 凭证。
 * COZE_SUPABASE_* 优先，兼容 legacy SUPABASE_*。
 * 拒绝 localhost 类 URL。
 */
function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  // COZE_* 优先，SUPABASE_* 兼容
  const url = process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey =
    process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      'COZE_SUPABASE_URL (or legacy SUPABASE_URL) is not set. ' +
        'Please configure your cloud Supabase credentials.'
    );
  }
  if (!anonKey) {
    throw new Error(
      'COZE_SUPABASE_ANON_KEY (or legacy SUPABASE_ANON_KEY) is not set. ' +
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

  return { url, anonKey, serviceRoleKey };
}

// ── 客户端工厂 ────────────────────────────────────────────────

/**
 * 服务端管理权限客户端。
 * 必须存在 service_role_key，否则抛出明确错误。
 * 使用 service_role_key 绕过 RLS，用于服务端管理操作。
 */
function getSupabaseServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseCredentials();

  if (!serviceRoleKey) {
    throw new Error(
      'COZE_SUPABASE_SERVICE_ROLE_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required ' +
        'for service-level operations. Server-side admin actions cannot proceed without it.'
    );
  }

  const globalOptions: Record<string, unknown> = {};
  const reportFetch = getSupabaseReportFetch('supabase-service');
  if (reportFetch) globalOptions.fetch = reportFetch;

  return createClient(url, serviceRoleKey, {
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

/**
 * 匿名/用户级客户端。
 * - 不传 token：使用 anon key（服务端无用户上下文时用 service_role_key 降级兜底）
 * - 传入 token：使用 anon key + 用户 Authorization header
 */
function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey, serviceRoleKey } = getSupabaseCredentials();

  // 有用户 token 时用 anon key；无 token 时优先用 service_role_key 兜底
  const key = token ? anonKey : (serviceRoleKey ?? anonKey);

  const globalOptions: Record<string, unknown> = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }
  const reportFetch = getSupabaseReportFetch('supabase');
  if (reportFetch) globalOptions.fetch = reportFetch;

  return createClient(url, key, {
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
