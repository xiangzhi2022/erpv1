import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
  createServerClient: vi.fn(),
  createSupabaseClient: vi.fn(),
  cookies: vi.fn(),
  getClaims: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mocks.createBrowserClient,
  createServerClient: mocks.createServerClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createSupabaseClient,
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('server-only', () => ({}));

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
] as const;

const originalEnvironment = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function configurePublicEnvironment(): void {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];
  configurePublicEnvironment();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('request-scoped Supabase server client', () => {
  it('creates a fresh client for each request and forwards cookie reads and writes', async () => {
    const firstStore = {
      getAll: vi.fn(() => [{ name: 'first', value: 'one' }]),
      set: vi.fn(),
    };
    const secondStore = {
      getAll: vi.fn(() => [{ name: 'second', value: 'two' }]),
      set: vi.fn(),
    };
    mocks.cookies.mockResolvedValueOnce(firstStore).mockResolvedValueOnce(secondStore);
    mocks.createServerClient
      .mockImplementationOnce((_url, _key, options) => ({ request: 1, options }))
      .mockImplementationOnce((_url, _key, options) => ({ request: 2, options }));

    const { createClient } = await import('@/lib/supabase/server');
    const firstClient = await createClient();
    const secondClient = await createClient();

    expect(firstClient).not.toBe(secondClient);
    expect(mocks.createServerClient).toHaveBeenCalledTimes(2);

    const firstCookieAdapter = mocks.createServerClient.mock.calls[0][2].cookies;
    expect(firstCookieAdapter.getAll()).toEqual([{ name: 'first', value: 'one' }]);

    firstCookieAdapter.setAll([
      { name: 'sb-session', value: 'refreshed', options: { httpOnly: true } },
    ]);
    expect(firstStore.set).toHaveBeenCalledWith('sb-session', 'refreshed', {
      httpOnly: true,
    });
  });
});

describe('Supabase admin client', () => {
  it('requires the server-only Secret Key and disables browser session behavior', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');

    expect(() => createAdminClient()).toThrow(/SUPABASE_SECRET_KEY/);
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled();

    process.env.SUPABASE_SECRET_KEY = 'sb_secret_example';
    mocks.createSupabaseClient.mockReturnValue({ admin: true });

    expect(createAdminClient()).toEqual({ admin: true });
    expect(mocks.createSupabaseClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_secret_example',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        }),
      }),
    );
  });
});

describe('Supabase session proxy', () => {
  it('uses getClaims and forwards refreshed cookies and cache headers', async () => {
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll(
            [{ name: 'sb-session', value: 'new-token', options: { httpOnly: true } }],
            { 'cache-control': 'private, no-store', 'x-supabase-api-version': '2024-01-01' },
          );
          return { data: { claims: { sub: 'user-1' } }, error: null };
        },
        getSession: mocks.getSession,
      },
    }));

    const { updateSession } = await import('@/lib/supabase/proxy');
    const request = new NextRequest('https://erp.example.com/orders', {
      headers: { cookie: 'sb-session=old-token' },
    });
    const result = await updateSession(request);

    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(result.claims).toEqual({ sub: 'user-1' });
    expect(request.cookies.get('sb-session')?.value).toBe('new-token');
    expect(result.response.cookies.get('sb-session')?.value).toBe('new-token');
    expect(result.response.headers.get('cache-control')).toBe('private, no-store');
    expect(result.response.headers.get('x-supabase-api-version')).toBe('2024-01-01');
  });

  it('redirects unauthenticated pages, returns 401 for APIs, and allows only explicit public auth routes', async () => {
    mocks.createServerClient.mockReturnValue({
      auth: {
        getClaims: mocks.getClaims.mockResolvedValue({ data: { claims: null }, error: null }),
        getSession: mocks.getSession,
      },
    });
    const { proxy } = await import('@/proxy');

    const pageResponse = await proxy(new NextRequest('https://erp.example.com/orders?view=open'));
    expect(pageResponse.status).toBe(307);
    expect(pageResponse.headers.get('location')).toBe(
      'https://erp.example.com/login?next=%2Forders%3Fview%3Dopen',
    );

    const apiResponse = await proxy(new NextRequest('https://erp.example.com/api/orders'));
    expect(apiResponse.status).toBe(401);
    await expect(apiResponse.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });

    const publicPage = await proxy(new NextRequest('https://erp.example.com/login'));
    const publicAuthApi = await proxy(
      new NextRequest('https://erp.example.com/api/auth/login', { method: 'POST' }),
    );
    expect(publicPage.status).toBe(200);
    expect(publicAuthApi.status).toBe(200);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});
