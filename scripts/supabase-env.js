#!/usr/bin/env node
/**
 * Supabase 环境变量检查与导出工具
 *
 * 用法:
 *   node scripts/supabase-env.js check     # 检查环境变量是否齐全
 *   node scripts/supabase-env.js print     # 打印当前 Supabase 配置（脱敏）
 *   node scripts/supabase-env.js export    # 输出 export 语句（供 shell source）
 *
 * 环境变量: NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY、
 * SUPABASE_SECRET_KEY
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

function loadAllEnv() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) return;
  loadFromEnvLocal();
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) return;
  loadFromDotenv();
}

// ── 统一读取（与 src/db/client.ts 规则一致） ─────────────────

function getCredentials() {
  loadAllEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  const secretKey = process.env.SUPABASE_SECRET_KEY || '';

  return { url, publishableKey, secretKey };
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
  const { url, publishableKey, secretKey } = getCredentials();
  let hasError = false;

  if (!url) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL is not set');
    hasError = true;
  } else if (isLocalUrl(url)) {
    console.error(`✗ Local Supabase URL is not supported: "${url}"`);
    hasError = true;
  } else {
    console.log('✓ NEXT_PUBLIC_SUPABASE_URL:', url);
  }

  if (!publishableKey) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set');
    hasError = true;
  } else {
    console.log('✓ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:', maskKey(publishableKey));
  }

  if (!secretKey) {
    console.warn('⚠ SUPABASE_SECRET_KEY is not set');
    console.warn('  Server-side admin operations will fail.');
  } else {
    console.log('✓ SUPABASE_SECRET_KEY:', maskKey(secretKey));
  }

  if (hasError) {
    process.exit(1);
  }
  console.log('\n✅ All required Supabase environment variables are configured.');
}

function cmdPrint() {
  const { url, publishableKey, secretKey } = getCredentials();

  console.log('Supabase Configuration (masked):');
  console.log('  URL:             ', url || '(not set)');
  console.log('  PUBLISHABLE_KEY:', maskKey(publishableKey));
  console.log('  SECRET_KEY:     ', maskKey(secretKey));

  if (url && isLocalUrl(url)) {
    console.error('\n⚠ WARNING: Local Supabase URL detected. This project requires a cloud instance.');
  }
}

function cmdExport() {
  const { url, publishableKey, secretKey } = getCredentials();

  if (url) console.log(`export NEXT_PUBLIC_SUPABASE_URL="${url}"`);
  if (publishableKey) {
    console.log(`export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${publishableKey}"`);
  }
  if (secretKey) console.log(`export SUPABASE_SECRET_KEY="${secretKey}"`);
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
