import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireDevEnv } from '@/app/api/debug/_lib/env-guard';

const mocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
  getUserFromRequest: vi.fn(),
}));

vi.mock('@/db/client', () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: mocks.getUserFromRequest,
}));

describe('debug endpoint environment guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hides diagnostic endpoints in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const response = requireDevEnv();

    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('allows diagnostic endpoints only in development', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(requireDevEnv()).toBeUndefined();
  });

  it('returns 404 from every real debug handler in production without touching the database', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const [{ GET: environment }, { GET: user }, { POST: settingsTest }] = await Promise.all([
      import('@/app/api/debug/env/route'),
      import('@/app/api/debug/user/route'),
      import('@/app/api/debug/settings-test/route'),
    ]);

    const responses = await Promise.all([
      environment(),
      user(new NextRequest('https://erp.example.com/api/debug/user')),
      settingsTest(new NextRequest('https://erp.example.com/api/debug/settings-test', {
        method: 'POST',
      })),
    ]);

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404]);
    await Promise.all(responses.map(async (response) => {
      await expect(response.json()).resolves.toEqual({ error: 'Not found' });
    }));
    expect(mocks.getSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.getUserFromRequest).not.toHaveBeenCalled();
  });
});
