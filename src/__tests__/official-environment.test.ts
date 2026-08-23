import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.hoisted(() => vi.fn(() => ({ client: true })));

vi.mock('server-only', () => ({}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'COZE_SUPABASE_URL',
  'COZE_SUPABASE_ANON_KEY',
  'COZE_SUPABASE_SERVICE_ROLE_KEY',
  'COZE_PROJECT_ENV',
] as const;

const originalEnvironment = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

beforeEach(() => {
  vi.resetModules();
  createClientMock.mockClear();
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnvironment[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('Supabase environment', () => {
  it('reads the official publishable and secret key variables', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_example';

    const { getSupabaseCredentials } = await import('@/db/client');
    const readCredentials = () => getSupabaseCredentials();

    expect(readCredentials).not.toThrow();
    expect(readCredentials()).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
      secretKey: 'sb_secret_example',
    });
  });

  it('does not accept removed Coze aliases', async () => {
    process.env.COZE_SUPABASE_URL = 'https://legacy.supabase.co';
    process.env.COZE_SUPABASE_ANON_KEY = 'legacy-anon-key';
    process.env.COZE_SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-key';

    const { getSupabaseCredentials } = await import('@/db/client');

    expect(() => getSupabaseCredentials()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('uses the publishable key for user clients and isolates the secret key in the admin client', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_example';

    const { getSupabaseClient } = await import('@/db/client');
    const { createAdminClient } = await import('@/lib/supabase/admin');

    getSupabaseClient('user-token');
    expect(createClientMock).toHaveBeenLastCalledWith(
      'https://example.supabase.co',
      'sb_publishable_example',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer user-token' } },
      }),
    );

    createAdminClient();
    expect(createClientMock).toHaveBeenLastCalledWith(
      'https://example.supabase.co',
      'sb_secret_example',
      expect.any(Object),
    );
  });

  it('rejects service clients when the secret key is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_example';

    const { createAdminClient } = await import('@/lib/supabase/admin');

    expect(() => createAdminClient()).toThrow(/SUPABASE_SECRET_KEY/);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

describe('runtime environment', () => {
  it('uses NODE_ENV even when a removed Coze environment value exists', async () => {
    process.env.NODE_ENV = 'production';
    process.env.COZE_PROJECT_ENV = 'DEV';

    const { isDevEnv } = await import('@/app/api/debug/_lib/env-guard');

    expect(isDevEnv()).toBe(false);
  });
});
