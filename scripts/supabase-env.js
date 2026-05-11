#!/usr/bin/env node
/**
 * Supabase 环境变量检查与导出工具
 *
 * 用法:
 *   node scripts/supabase-env.js check     # 检查环境变量是否齐全
 *   node scripts/supabase-env.js print     # 打印当前 Supabase 配置（脱敏）
 *   node scripts/supabase-env.js export    # 输出 export 语句（供 shell source）
 *
 * 环境变量优先级: COZE_SUPABASE_* > SUPABASE_*（legacy 兼容）
 * 明确拒绝 localhost / 127.0.0.1 / ::1 / *.local 的 Supabase URL
 */

const LOCAL_HOST_PATTERNS = [
  /^https?:\/\/localhost\b/i,
  /^https?:\/\/127\.0\.0\.1\b/i,
  /^https?:\/\/\[\s*::1\s*\]/i,
  /\.local\b/i,
];

// ── 环境变量读取（与 src/db/client.ts 规则一致） ─────────────

function loadFromEnvLocal() {
  const fs = require('fs');
  const path = require('path');
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envLocalPath)) return;

  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length && !key.startsWith('#')) {
      const trimmedKey = key.trim();
      if (!process.env[trimmedKey]) {
        process.env[trimmedKey] = valueParts.join('=').trim();
      }
    }
  });
}

function loadFromDotenv() {
  try {
    require('dotenv').config();
  } catch {
    // dotenv 不可用
  }
}

function loadFromCozeWorkload() {
  const { execSync } = require('child_process');
  try {
    const pythonCode = `
import os, sys
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
    output
      .trim()
      .split('\n')
      .forEach((line) => {
        if (line.startsWith('#')) return;
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
      });
  } catch {
    // 静默
  }
}

function loadAllEnv() {
  if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) return;
  loadFromEnvLocal();
  if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) return;
  loadFromDotenv();
  if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) return;
  loadFromCozeWorkload();
}

// ── 统一读取（与 src/db/client.ts 规则一致） ─────────────────

function getCredentials() {
  loadAllEnv();

  const url = process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey =
    process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return { url, anonKey, serviceRoleKey };
}

// ── 工具函数 ──────────────────────────────────────────────────

function isLocalUrl(url) {
  return LOCAL_HOST_PATTERNS.some((p) => p.test(url));
}

function maskKey(key) {
  if (!key) return '(not set)';
  if (key.length <= 12) return key.substring(0, 4) + '****';
  return key.substring(0, 6) + '****' + key.substring(key.length - 4);
}

// ── 子命令 ────────────────────────────────────────────────────

function cmdCheck() {
  const { url, anonKey, serviceRoleKey } = getCredentials();
  let hasError = false;

  if (!url) {
    console.error('✗ COZE_SUPABASE_URL (or SUPABASE_URL) is not set');
    hasError = true;
  } else if (isLocalUrl(url)) {
    console.error(`✗ Local Supabase URL is not supported: "${url}"`);
    hasError = true;
  } else {
    console.log('✓ COZE_SUPABASE_URL:', url);
  }

  if (!anonKey) {
    console.error('✗ COZE_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) is not set');
    hasError = true;
  } else {
    console.log('✓ COZE_SUPABASE_ANON_KEY:', maskKey(anonKey));
  }

  if (!serviceRoleKey) {
    console.warn('⚠ COZE_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set');
    console.warn('  Server-side admin operations will fail.');
  } else {
    console.log('✓ COZE_SUPABASE_SERVICE_ROLE_KEY:', maskKey(serviceRoleKey));
  }

  if (hasError) {
    process.exit(1);
  }
  console.log('\n✅ All required Supabase environment variables are configured.');
}

function cmdPrint() {
  const { url, anonKey, serviceRoleKey } = getCredentials();

  console.log('Supabase Configuration (masked):');
  console.log('  URL:             ', url || '(not set)');
  console.log('  ANON_KEY:        ', maskKey(anonKey));
  console.log('  SERVICE_ROLE_KEY:', maskKey(serviceRoleKey));

  if (url && isLocalUrl(url)) {
    console.error('\n⚠ WARNING: Local Supabase URL detected. This project requires a cloud instance.');
  }
}

function cmdExport() {
  const { url, anonKey, serviceRoleKey } = getCredentials();

  if (url) console.log(`export COZE_SUPABASE_URL="${url}"`);
  if (anonKey) console.log(`export COZE_SUPABASE_ANON_KEY="${anonKey}"`);
  if (serviceRoleKey) console.log(`export COZE_SUPABASE_SERVICE_ROLE_KEY="${serviceRoleKey}"`);
}

// ── CLI 入口 ──────────────────────────────────────────────────

const command = process.argv[2] || 'check';

switch (command) {
  case 'check':
    cmdCheck();
    break;
  case 'print':
    cmdPrint();
    break;
  case 'export':
    cmdExport();
    break;
  default:
    console.error(`Unknown command: "${command}"`);
    console.error('Usage: node scripts/supabase-env.js [check|print|export]');
    process.exit(1);
}
