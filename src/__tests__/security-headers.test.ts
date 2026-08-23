import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock('server-only', () => ({}));

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function extractNonce(csp: string): string {
  const match = csp.match(/script-src[^;]*'nonce-([^']+)'/);
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';
  mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.createServerClient.mockImplementation(() => ({
    auth: { getClaims: mocks.getClaims },
    rpc: mocks.rpc,
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (originalSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  if (originalSupabaseKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalSupabaseKey;
});

describe('dynamic Content Security Policy', () => {
  it('overwrites inbound security identifiers and forwards one nonce and request ID to rendering and the response', async () => {
    const { proxy } = await import('@/proxy');
    const response = await proxy(new NextRequest('https://erp.example.com/login', {
      headers: {
        'content-security-policy': "script-src 'nonce-attacker'",
        'x-nonce': 'attacker',
        'x-request-id': 'attacker-request',
      },
    }));

    const responseCsp = response.headers.get('content-security-policy') ?? '';
    const requestCsp = response.headers.get('x-middleware-request-content-security-policy') ?? '';
    const nonce = extractNonce(responseCsp);
    const requestId = response.headers.get('x-request-id');

    expect(nonce).not.toBe('attacker');
    expect(requestCsp).toBe(responseCsp);
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requestId).not.toBe('attacker-request');
    expect(response.headers.get('x-middleware-request-x-request-id')).toBe(requestId);
  });

  it('uses a fresh cryptographic nonce and request ID for every request', async () => {
    const { proxy } = await import('@/proxy');
    const first = await proxy(new NextRequest('https://erp.example.com/login'));
    const second = await proxy(new NextRequest('https://erp.example.com/login'));

    expect(extractNonce(first.headers.get('content-security-policy') ?? ''))
      .not.toBe(extractNonce(second.headers.get('content-security-policy') ?? ''));
    expect(first.headers.get('x-request-id')).not.toBe(second.headers.get('x-request-id'));
  });

  it('allows only the configured Supabase HTTPS and Realtime WSS origins', async () => {
    const { proxy } = await import('@/proxy');
    const response = await proxy(new NextRequest('https://erp.example.com/login'));
    const csp = response.headers.get('content-security-policy') ?? '';

    expect(csp).toContain("connect-src 'self' https://example.supabase.co wss://example.supabase.co");
    expect(csp).toContain("img-src 'self' data: blob: https://example.supabase.co");
    expect(csp).not.toContain('*');
  });

  it('uses strict script nonces in production and permits unsafe-eval only in development', async () => {
    const { proxy } = await import('@/proxy');
    const production = await proxy(new NextRequest('https://erp.example.com/login'));
    const productionCsp = production.headers.get('content-security-policy') ?? '';

    expect(productionCsp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(productionCsp).not.toContain("'unsafe-eval'");
    expect(productionCsp).toContain("style-src 'self' 'unsafe-inline'");
    expect(productionCsp).toContain("frame-ancestors 'none'");

    vi.stubEnv('NODE_ENV', 'development');
    const development = await proxy(new NextRequest('https://erp.example.com/login'));
    expect(development.headers.get('content-security-policy')).toContain("'unsafe-eval'");
  });
});

describe('Proxy matcher security boundary', () => {
  it.each([
    '/orders/order.pdf',
    '/employees/person.jpg',
    '/api/orders/order.json',
    '/api/settings/profile.xml',
  ])('does not let a dotted dynamic route bypass Proxy: %s', async (url) => {
    const { config } = await import('@/proxy');
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true);
  });

  it.each([
    '/_next/static/chunks/app.js',
    '/_next/image?url=%2Favatar.png&w=64&q=75',
    '/favicon.ico',
    '/robots.txt',
    '/file.svg',
  ])('skips only an explicit static resource: %s', async (url) => {
    const { config } = await import('@/proxy');
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false);
  });
});
