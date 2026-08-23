import { NextResponse } from 'next/server';
import type { ApiFieldErrors } from './errors';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    fieldErrors?: ApiFieldErrors;
  };
}

export interface ApiSuccessBody<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiSuccessResult<T> {
  readonly kind: 'success';
  readonly data: T;
  readonly status: number;
  readonly meta?: Record<string, unknown>;
  readonly headers?: HeadersInit;
}

interface ApiSuccessOptions {
  status?: number;
  meta?: Record<string, unknown>;
  headers?: HeadersInit;
}

export function apiSuccess<T>(data: T, options: ApiSuccessOptions = {}): ApiSuccessResult<T> {
  return {
    kind: 'success',
    data,
    status: options.status ?? 200,
    meta: options.meta,
    headers: options.headers,
  };
}

export function successResponse<T>(result: ApiSuccessResult<T>, requestId: string): NextResponse {
  const body: ApiSuccessBody<T> = result.meta
    ? { data: result.data, meta: result.meta }
    : { data: result.data };
  const response = NextResponse.json(body, { status: result.status, headers: result.headers });
  response.headers.set('x-request-id', requestId);
  return response;
}

export function errorResponse(
  error: { code: string; message: string; fieldErrors?: ApiFieldErrors },
  status: number,
  requestId: string,
  headers?: HeadersInit,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
    },
  };
  const response = NextResponse.json(body, { status, headers });
  response.headers.set('x-request-id', requestId);
  response.headers.set('cache-control', 'no-store');
  return response;
}
