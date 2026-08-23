import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { EnterpriseContext } from '@/lib/enterprise/context';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import type { EnterprisePermissionCode } from '@/lib/enterprise/permissions';
import { createClient } from '@/lib/supabase/server';
import { logger as defaultLogger, type StructuredLogger } from '@/lib/observability/logger';
import { ApiError, isApiError } from './errors';
import type { RouteParams } from './request';
import {
  errorResponse,
  successResponse,
  type ApiSuccessResult,
} from './response';

type ApiPolicy = 'public' | 'authenticated' | 'enterprise';

export interface ApiHandlerDependencies {
  getIdentityId?: (request: NextRequest) => Promise<string | null>;
  getEnterpriseContext?: () => Promise<EnterpriseContext>;
  logger?: Pick<StructuredLogger, 'error'>;
}

export interface ApiHandlerOptions {
  policy: ApiPolicy;
  permission?: EnterprisePermissionCode;
  dependencies?: ApiHandlerDependencies;
}

export interface ApiHandlerContext {
  request: NextRequest;
  requestId: string;
  params?: RouteParams;
  identityId?: string;
  enterprise?: EnterpriseContext;
}

interface NextRouteContext {
  params?: RouteParams;
}

type Handler<T> = (context: ApiHandlerContext) => Promise<ApiSuccessResult<T>> | ApiSuccessResult<T>;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function resolveRequestId(request: NextRequest): string {
  const candidate = request.headers.get('x-request-id');
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

async function defaultIdentityId(): Promise<string | null> {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  return error || !data?.claims?.sub ? null : data.claims.sub;
}

function enterpriseError(error: unknown): ApiError | null {
  if (!isEnterpriseAccessError(error)) return null;
  return new ApiError(error.code, error.status, error.message);
}

export function withApiHandler<T>(options: ApiHandlerOptions, handler: Handler<T>) {
  return async function apiRoute(
    request: NextRequest,
    routeContext: NextRouteContext = {},
  ) {
    const requestId = resolveRequestId(request);
    const log = options.dependencies?.logger ?? defaultLogger;

    try {
      const context: ApiHandlerContext = {
        request,
        requestId,
        params: routeContext.params,
      };

      if (options.policy === 'authenticated') {
        const identityId = await (options.dependencies?.getIdentityId ?? defaultIdentityId)(request);
        if (!identityId) throw ApiError.unauthorized();
        context.identityId = identityId;
      }

      if (options.policy === 'enterprise') {
        const enterprise = await (
          options.dependencies?.getEnterpriseContext ?? getEnterpriseContext
        )();
        if (options.permission) requirePermission(enterprise, options.permission);
        context.identityId = enterprise.userId;
        context.enterprise = enterprise;
      }

      return successResponse(await handler(context), requestId);
    } catch (caught) {
      const known = isApiError(caught) ? caught : enterpriseError(caught);
      if (known) return errorResponse(known, known.status, requestId);

      log.error('api.unhandled_error', {
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        error: caught instanceof Error ? caught : new Error('Non-Error exception'),
      });
      return errorResponse(
        { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
        500,
        requestId,
      );
    }
  };
}
