import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireDevEnv } from '@/app/api/debug/_lib/env-guard';

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
});
