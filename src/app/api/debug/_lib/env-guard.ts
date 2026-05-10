import { NextResponse } from 'next/server';

/**
 * Returns true when running in the development environment.
 * COZE_PROJECT_ENV is set to 'DEV' in sandbox and 'PROD' in production.
 */
export function isDevEnv(): boolean {
  return process.env.COZE_PROJECT_ENV !== 'PROD';
}

/**
 * Guard that rejects requests in production with a 403 response.
 * Returns `undefined` when the request is allowed (dev mode).
 */
export function requireDevEnv(): NextResponse | undefined {
  if (!isDevEnv()) {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 },
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
