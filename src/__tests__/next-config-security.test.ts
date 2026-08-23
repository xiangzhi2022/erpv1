import { describe, expect, it } from 'vitest';
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern';
import nextConfig from '../../next.config';

describe('Next.js production security configuration', () => {
  it.each([
    'https://attacker.example/avatar.png',
    'https://localhost/internal.png',
    'https://127.0.0.1/internal.png',
    'https://metadata.google.internal/computeMetadata/v1/',
  ])('does not authorize untrusted image optimization for %s', (url) => {
    const domains = nextConfig.images?.domains ?? [];
    const remotePatterns = nextConfig.images?.remotePatterns ?? [];

    expect(hasRemoteMatch(domains, remotePatterns, new URL(url))).toBe(false);
  });

  it('disables framework disclosure and applies the required static headers globally', async () => {
    expect(nextConfig.poweredByHeader).toBe(false);

    const rules = await nextConfig.headers?.();
    const globalRule = rules?.find((rule) => rule.source === '/:path*');
    const headers = Object.fromEntries(
      (globalRule?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value]),
    );

    expect(headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()',
      'cross-origin-opener-policy': 'same-origin',
      'x-frame-options': 'DENY',
    });
    expect(headers).not.toHaveProperty('content-security-policy');
    expect(headers).not.toHaveProperty('strict-transport-security');
  });
});
