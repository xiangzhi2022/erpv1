import 'server-only';

import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { ApiError } from '@/lib/api/errors';
import { createAdminClient } from '@/lib/supabase/admin';

interface RpcResult {
  data: unknown;
  error: unknown;
}

type RateLimitRpc = (
  functionName: string,
  args: Record<string, unknown>,
) => PromiseLike<RpcResult>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface ConsumeRateLimitOptions {
  bucket: string;
  identifier: string;
  identifierKind?: 'opaque' | 'account';
  limit: number;
  windowSeconds: number;
  pepper?: string;
  rpc?: RateLimitRpc;
}

interface ResolveClientIpOptions {
  netlify?: boolean;
}

interface RateLimitRow {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
}

const BUCKET_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const MINIMUM_PEPPER_LENGTH = 16;
const MAXIMUM_LIMIT = 1_000_000;
const MAXIMUM_WINDOW_SECONDS = 2_592_000;

function configurationError(): ApiError {
  return new ApiError('RATE_LIMIT_CONFIG_INVALID', 503, '请求频率保护配置无效');
}

function unavailableError(): ApiError {
  return new ApiError('RATE_LIMIT_UNAVAILABLE', 503, '请求频率保护暂时不可用');
}

function identityUnavailableError(): ApiError {
  return new ApiError(
    'RATE_LIMIT_IDENTITY_UNAVAILABLE',
    503,
    '无法验证请求来源',
  );
}

function firstRow(data: unknown): RateLimitRow | null {
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') return null;
  const row = data[0] as Partial<RateLimitRow>;
  if (
    typeof row.allowed !== 'boolean'
    || !Number.isInteger(row.remaining)
    || !Number.isInteger(row.retry_after_seconds)
    || (row.remaining ?? -1) < 0
    || (row.retry_after_seconds ?? -1) < 0
  ) return null;
  return row as RateLimitRow;
}

function expandIpv6(canonical: string): number[] | null {
  const halves = canonical.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right];
  if (groups.length !== 8) return null;
  const parsed = groups.map((group) => Number.parseInt(group, 16));
  return parsed.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff)
    ? parsed
    : null;
}

function canonicalIpv6(groups: number[]): string | null {
  try {
    const expanded = groups.map((group) => group.toString(16)).join(':');
    const hostname = new URL(`http://[${expanded}]/`).hostname;
    return hostname.slice(1, -1).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Produces an abuse-resistant rate-limit identity for a single client address.
 * Native IPv6 is grouped at /64 and IPv4-mapped IPv6 is folded into IPv4.
 * Comma-separated forwarding chains and zone-scoped addresses are rejected.
 */
export function normalizeClientIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let candidate = raw.trim();
  if (!candidate || candidate.includes(',') || candidate.includes('%')) return null;
  if (candidate.startsWith('[') && candidate.endsWith(']')) {
    candidate = candidate.slice(1, -1);
  }

  const version = isIP(candidate);
  if (version === 4) return candidate;
  if (version !== 6) return null;

  try {
    const hostname = new URL(`http://[${candidate}]/`).hostname;
    const canonical = hostname.slice(1, -1).toLowerCase();
    const groups = expandIpv6(canonical);
    if (!groups) return null;
    if (
      groups.slice(0, 5).every((group) => group === 0)
      && groups[5] === 0xffff
    ) {
      return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');
    }
    const network = canonicalIpv6([...groups.slice(0, 4), 0, 0, 0, 0]);
    return network ? `${network}/64` : null;
  } catch {
    return null;
  }
}

/**
 * Netlify strips inbound copies and supplies this header at its function
 * boundary. Never trust x-forwarded-for here: callers can forge its first hop.
 */
export function resolveClientIp(
  request: Request,
  options: ResolveClientIpOptions = {},
): string | null {
  const isNetlify = options.netlify ?? Boolean(process.env.SITE_ID);
  if (!isNetlify) return null;
  return normalizeClientIp(request.headers.get('x-nf-client-connection-ip'));
}

export function requireTrustedClientIp(
  request: Request,
  options: ResolveClientIpOptions = {},
): string {
  const clientIp = resolveClientIp(request, options);
  if (!clientIp) throw identityUnavailableError();
  return clientIp;
}

export async function consumeRateLimit({
  bucket,
  identifier,
  identifierKind = 'opaque',
  limit,
  windowSeconds,
  pepper = process.env.RATE_LIMIT_PEPPER,
  rpc,
}: ConsumeRateLimitOptions): Promise<RateLimitResult> {
  if (
    !BUCKET_PATTERN.test(bucket)
    || !identifier
    || !Number.isSafeInteger(limit)
    || limit < 1
    || limit > MAXIMUM_LIMIT
    || !Number.isSafeInteger(windowSeconds)
    || windowSeconds < 1
    || windowSeconds > MAXIMUM_WINDOW_SECONDS
    || !pepper
    || pepper.length < MINIMUM_PEPPER_LENGTH
  ) throw configurationError();

  const canonicalIdentifier = identifierKind === 'account'
    ? identifier.trim().toLowerCase()
    : identifier;
  if (!canonicalIdentifier) throw configurationError();

  const identifierHash = createHmac('sha256', pepper)
    .update(`${bucket}\0${canonicalIdentifier}`)
    .digest('hex');
  const call = rpc ?? ((functionName, args) => createAdminClient().rpc(functionName, args));

  let result: RpcResult;
  try {
    result = await call('consume_api_rate_limit', {
      target_bucket: bucket,
      target_identifier_hash: identifierHash,
      target_limit: limit,
      target_window_seconds: windowSeconds,
    });
  } catch {
    throw unavailableError();
  }

  const row = firstRow(result.data);
  if (result.error || !row) throw unavailableError();
  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

export async function enforceRateLimit(
  options: ConsumeRateLimitOptions,
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(options);
  if (!result.allowed) {
    throw ApiError.rateLimited('RATE_LIMITED', '请求过于频繁', result.retryAfterSeconds);
  }
  return result;
}
