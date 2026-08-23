const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /password|cookie|authorization|token|secret|captcha|supabase.*(?:key|url)|(?:publishable|anon|service_role)_?key/i;

function sanitizeString(value: string): string {
  return value
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|cookie|authorization|token|secret|captcha)=([^\s,;&]+)/gi, '$1=[REDACTED]');
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(item, seen);
  }
  return output;
}

export function redactSecrets(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}
