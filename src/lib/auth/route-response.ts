import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { AuthServiceError } from './service';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function resolveRequestId(request?: Request): string {
  const candidate = request?.headers.get('x-request-id');
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

export function authRouteError(error: unknown, request?: Request): NextResponse {
  if (isApiError(error)) {
    return errorResponse(
      error,
      error.status,
      resolveRequestId(request),
      error.responseHeaders,
    );
  }
  if (error instanceof AuthServiceError) {
    return NextResponse.json(
      { success: false, error: error.message, error_code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { success: false, error: '认证服务暂时不可用', error_code: 'AUTH_UNAVAILABLE' },
    { status: 503 },
  );
}

export function authValidationError(message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message, error_code: 'INVALID_REQUEST' },
    { status: 400 },
  );
}
