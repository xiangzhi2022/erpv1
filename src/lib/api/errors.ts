export type ApiFieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: ApiFieldErrors,
    public readonly responseHeaders?: HeadersInit,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static unauthorized(code = 'UNAUTHORIZED', message = '请先登录'): ApiError {
    return new ApiError(code, 401, message);
  }

  static forbidden(code = 'FORBIDDEN', message = '没有执行该操作的权限'): ApiError {
    return new ApiError(code, 403, message);
  }

  static notFound(code = 'NOT_FOUND', message = '资源不存在'): ApiError {
    return new ApiError(code, 404, message);
  }

  static conflict(code = 'CONFLICT', message = '资源状态冲突'): ApiError {
    return new ApiError(code, 409, message);
  }

  static unprocessable(code = 'UNPROCESSABLE_ENTITY', message = '请求无法处理'): ApiError {
    return new ApiError(code, 422, message);
  }

  static rateLimited(
    code = 'RATE_LIMITED',
    message = '请求过于频繁',
    retryAfterSeconds?: number,
  ): ApiError {
    return new ApiError(
      code,
      429,
      message,
      undefined,
      retryAfterSeconds && retryAfterSeconds > 0
        ? { 'retry-after': String(Math.ceil(retryAfterSeconds)) }
        : undefined,
    );
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
