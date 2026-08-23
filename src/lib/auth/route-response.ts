import { NextResponse } from 'next/server';
import { AuthServiceError } from './service';

export function authRouteError(error: unknown): NextResponse {
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
