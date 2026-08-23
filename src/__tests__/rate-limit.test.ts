import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  consumeRateLimit,
  enforceRateLimit,
  normalizeClientIp,
  requireTrustedClientIp,
  resolveClientIp,
} from '@/lib/security/rate-limit';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('durable API rate limiting', () => {
  it('documents the required server-only pepper and production release gate', () => {
    const environmentTemplate = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
    const productionGate = readFileSync(resolve(
      process.cwd(),
      'docs/auth-production-gate.md',
    ), 'utf8');

    expect(environmentTemplate).toMatch(/^RATE_LIMIT_PEPPER=/m);
    expect(productionGate).toContain('RATE_LIMIT_PEPPER');
    expect(productionGate).toMatch(/Netlify[\s\S]*protected environment variable/i);
  });

  it('keeps bucket state private and exposes only a service-role wrapper', () => {
    const migration = readFileSync(resolve(
      process.cwd(),
      'supabase/migrations/20260823112000_api_rate_limits.sql',
    ), 'utf8');

    expect(migration).toMatch(/create table app_private\.api_rate_limit_buckets/i);
    expect(migration).toMatch(/create function app_private\.consume_rate_limit/i);
    expect(migration).toMatch(/create function public\.consume_api_rate_limit/i);
    expect(migration).toMatch(/create index api_rate_limit_buckets_window_started_at_idx/i);
    expect(migration).toMatch(/grant execute on function public\.consume_api_rate_limit[\s\S]*to service_role/i);
    expect(migration).toMatch(/revoke all on (?:table|function)[\s\S]*from public, anon, authenticated/i);
    expect(migration).toMatch(/on conflict[\s\S]*do update/i);
    expect(migration).toMatch(/for update skip locked[\s\S]*limit 128/i);
  });

  it.each([
    ['192.0.2.10', '192.0.2.10'],
    [' 192.0.2.10 ', '192.0.2.10'],
    ['2001:0db8:0:0:0:0:0:1', '2001:db8::/64'],
    ['[2001:db8::abcd]', '2001:db8::/64'],
    ['::ffff:192.0.2.10', '192.0.2.10'],
  ])('normalizes valid IPv4 and IPv6 addresses', (raw, normalized) => {
    expect(normalizeClientIp(raw)).toBe(normalized);
  });

  it.each(['', 'unknown', '192.0.2.1, 198.51.100.1', '192.0.2.999', '2001:db8::1%eth0'])
    ('rejects invalid or ambiguous IP input', (raw) => {
      expect(normalizeClientIp(raw)).toBeNull();
    });

  it('trusts only the Netlify-owned client IP header in production', () => {
    const request = new Request('https://erp.example.test/api/auth/login', {
      headers: {
        'x-nf-client-connection-ip': '2001:0db8::1',
        'x-forwarded-for': '203.0.113.50',
      },
    });

    expect(resolveClientIp(request, { netlify: true })).toBe('2001:db8::/64');
    expect(resolveClientIp(new Request(request.url, {
      headers: { 'x-forwarded-for': '203.0.113.50' },
    }), { netlify: true })).toBeNull();
  });

  it('uses the Netlify runtime SITE_ID marker, not a build-only flag', () => {
    const request = new Request('https://erp.example.test/api/auth/login', {
      headers: { 'x-nf-client-connection-ip': '192.0.2.10' },
    });

    vi.stubEnv('NETLIFY', 'true');
    vi.stubEnv('SITE_ID', '');
    expect(resolveClientIp(request)).toBeNull();

    vi.stubEnv('SITE_ID', 'site-id-from-functions-runtime');
    expect(resolveClientIp(request)).toBe('192.0.2.10');
  });

  it('hashes the route and identifier before calling the database', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: true, remaining: 4, retry_after_seconds: 0 }],
      error: null,
    });

    const result = await consumeRateLimit({
      bucket: 'auth.login.account',
      identifier: 'Person@Example.com',
      limit: 5,
      windowSeconds: 900,
      pepper: 'test-pepper-with-enough-entropy',
      rpc,
    });

    expect(result).toEqual({ allowed: true, remaining: 4, retryAfterSeconds: 0 });
    expect(rpc).toHaveBeenCalledWith('consume_api_rate_limit', expect.objectContaining({
      target_bucket: 'auth.login.account',
      target_identifier_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      target_limit: 5,
      target_window_seconds: 900,
    }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('Person@Example.com');
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('test-pepper-with-enough-entropy');
  });

  it('canonicalizes equivalent login accounts into the same bucket hash', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: true, remaining: 4, retry_after_seconds: 0 }],
      error: null,
    });
    const base = {
      bucket: 'auth.login.account',
      limit: 5,
      windowSeconds: 900,
      pepper: 'test-pepper-with-enough-entropy',
      identifierKind: 'account' as const,
      rpc,
    };

    await consumeRateLimit({ ...base, identifier: ' Person@Example.COM ' });
    await consumeRateLimit({ ...base, identifier: 'person@example.com' });

    expect(rpc.mock.calls[0][1].target_identifier_hash)
      .toBe(rpc.mock.calls[1][1].target_identifier_hash);
  });

  it('returns the durable retry interval when a bucket is exhausted', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: false, remaining: 0, retry_after_seconds: 37 }],
      error: null,
    });

    await expect(consumeRateLimit({
      bucket: 'auth.register.ip',
      identifier: '192.0.2.10',
      limit: 5,
      windowSeconds: 3600,
      pepper: 'test-pepper-with-enough-entropy',
      rpc,
    })).resolves.toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 37 });
  });

  it('raises a 429 error carrying Retry-After when enforcement rejects', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: false, remaining: 0, retry_after_seconds: 37 }],
      error: null,
    });

    await expect(enforceRateLimit({
      bucket: 'auth.login.ip',
      identifier: '192.0.2.10',
      limit: 10,
      windowSeconds: 900,
      pepper: 'test-pepper-with-enough-entropy',
      rpc,
    })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      responseHeaders: { 'retry-after': '37' },
    });
  });

  it('fails closed when a trusted Netlify client IP is unavailable', () => {
    expect(() => requireTrustedClientIp(new Request('https://erp.example.test/api/auth/login'), {
      netlify: true,
    })).toThrow(expect.objectContaining({ code: 'RATE_LIMIT_IDENTITY_UNAVAILABLE', status: 503 }));
  });

  it('fails closed when the durable limiter is unavailable', async () => {
    await expect(consumeRateLimit({
      bucket: 'auth.login.ip',
      identifier: '192.0.2.10',
      limit: 10,
      windowSeconds: 900,
      pepper: 'test-pepper-with-enough-entropy',
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'secret db detail' } }),
    })).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE', status: 503 });
  });

  it('rejects unsafe configuration before calling the database', async () => {
    const rpc = vi.fn();

    await expect(consumeRateLimit({
      bucket: 'auth.login.ip',
      identifier: '192.0.2.10',
      limit: 0,
      windowSeconds: 900,
      pepper: 'short',
      rpc,
    })).rejects.toMatchObject({ code: 'RATE_LIMIT_CONFIG_INVALID', status: 503 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects values above the database configuration ceiling', async () => {
    const rpc = vi.fn();

    await expect(consumeRateLimit({
      bucket: 'auth.login.ip',
      identifier: '192.0.2.10',
      limit: 1_000_001,
      windowSeconds: 2_592_001,
      pepper: 'test-pepper-with-enough-entropy',
      rpc,
    })).rejects.toMatchObject({ code: 'RATE_LIMIT_CONFIG_INVALID', status: 503 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
