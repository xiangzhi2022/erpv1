import { NextResponse } from 'next/server';

/**
 * Returns true when running in the development environment.
 * NODE_ENV is set to 'production' in production deployments.
 */
export function isDevEnv(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Guard that makes diagnostic routes indistinguishable from missing routes in production.
 * Returns `undefined` when the request is allowed (dev mode).
 */
export function requireDevEnv(): NextResponse | undefined {
  if (!isDevEnv()) {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 },
    );
  }
  return undefined;
}

/**
 * Strips stack traces and internal details from an error, returning a
 * safe public message suitable for responses.
 */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred';
}
