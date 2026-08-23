import { describe, expect, it } from 'vitest';
import { createLogger } from '@/lib/observability/logger';
import { redactSecrets } from '@/lib/observability/redact';

describe('structured log redaction', () => {
  it('recursively redacts credentials and authentication material', () => {
    const sanitized = redactSecrets({
      password: 'plain-password',
      nested: {
        authorization: 'Bearer abc',
        cookie: 'session=secret',
        accessToken: 'token-value',
        captcha: '123456',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        SUPABASE_SECRET_KEY: 'secret-key',
      },
      array: [{ client_secret: 'oauth-secret' }, { safe: 'visible' }],
    });
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain('plain-password');
    expect(serialized).not.toContain('Bearer abc');
    expect(serialized).not.toContain('session=secret');
    expect(serialized).not.toContain('token-value');
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain('publishable-key');
    expect(serialized).not.toContain('oauth-secret');
    expect(serialized).toContain('visible');
  });

  it('serializes the exception class and stack without leaking secret fields', () => {
    const lines: string[] = [];
    const logger = createLogger((line) => lines.push(line));

    logger.error('api.unhandled_error', {
      requestId: 'req-1',
      error: new TypeError('connection failed'),
      token: 'never-log-me',
    });

    const payload = JSON.parse(lines[0]) as {
      level: string;
      event: string;
      error: { name: string; message: string; stack: string };
      token: string;
    };
    expect(payload.level).toBe('error');
    expect(payload.event).toBe('api.unhandled_error');
    expect(payload.error.name).toBe('TypeError');
    expect(payload.error.stack).toContain('TypeError: connection failed');
    expect(payload.token).toBe('[REDACTED]');
    expect(lines[0]).not.toContain('never-log-me');
  });
});
