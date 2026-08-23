import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { withApiHandler } from '@/lib/api/handler';
import { parseJson, parseParams, parseQuery } from '@/lib/api/request';
import { apiSuccess } from '@/lib/api/response';

function request(path = '/api/example', init?: RequestInit) {
  return new NextRequest(`https://erp.example.com${path}`, init);
}

describe('uniform API contract', () => {
  it('wraps success data and propagates a safe request ID', async () => {
    const route = withApiHandler({ policy: 'public' }, async () => (
      apiSuccess({ saved: true }, { meta: { cursor: 'next' }, status: 201 })
    ));
    const response = await route(request('/api/example', {
      headers: { 'x-request-id': 'req-123' },
    }));

    expect(response.status).toBe(201);
    expect(response.headers.get('x-request-id')).toBe('req-123');
    await expect(response.json()).resolves.toEqual({
      data: { saved: true },
      meta: { cursor: 'next' },
    });
  });

  it('maps empty and malformed bodies to INVALID_JSON', async () => {
    const schema = z.object({ name: z.string() });
    const route = withApiHandler({ policy: 'public' }, async ({ request: incoming }) => {
      const body = await parseJson(incoming, schema);
      return apiSuccess(body);
    });

    for (const body of ['', '{broken']) {
      const response = await route(request('/api/example', { method: 'POST', body }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'INVALID_JSON', requestId: expect.any(String) },
      });
    }
  });

  it('returns field errors for invalid body, query, and path input', async () => {
    const bodyRoute = withApiHandler({ policy: 'public' }, async ({ request: incoming }) => {
      await parseJson(incoming, z.object({ quantity: z.number().int().positive() }));
      return apiSuccess({ ok: true });
    });
    const queryRoute = withApiHandler({ policy: 'public' }, async ({ request: incoming }) => {
      const query = parseQuery(incoming, z.object({ page: z.coerce.number().int().positive() }));
      return apiSuccess(query);
    });
    const pathRoute = withApiHandler({ policy: 'public' }, async ({ params }) => {
      const path = await parseParams(params, z.object({ id: z.string().uuid() }));
      return apiSuccess(path);
    });

    const responses = [
      await bodyRoute(request('/api/example', { method: 'POST', body: JSON.stringify({ quantity: 0 }) })),
      await queryRoute(request('/api/example?page=zero')),
      await pathRoute(request(), { params: Promise.resolve({ id: 'bad-id' }) }),
    ];
    for (const response of responses) {
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'VALIDATION_FAILED',
          requestId: expect.any(String),
          fieldErrors: expect.any(Object),
        },
      });
    }
  });

  it('enforces authenticated and enterprise permission policies', async () => {
    const unauthenticated = withApiHandler({
      policy: 'authenticated',
      dependencies: { getIdentityId: vi.fn(async () => null) },
    }, async () => apiSuccess({ ok: true }));
    const forbidden = withApiHandler({
      policy: 'enterprise',
      permission: 'orders.manage',
      dependencies: {
        getEnterpriseContext: vi.fn(async () => ({ grants: new Set(['orders.read']) })),
      },
    }, async () => apiSuccess({ ok: true }));

    expect((await unauthenticated(request())).status).toBe(401);
    const forbiddenResponse = await forbidden(request());
    expect(forbiddenResponse.status).toBe(403);
    await expect(forbiddenResponse.json()).resolves.toMatchObject({
      error: { code: 'ENTERPRISE_PERMISSION_DENIED' },
    });
  });

  it.each([
    [ApiError.notFound('ORDER_NOT_FOUND', '订单不存在'), 404, 'ORDER_NOT_FOUND'],
    [ApiError.conflict('ORDER_STATE_CONFLICT', '订单状态冲突'), 409, 'ORDER_STATE_CONFLICT'],
    [ApiError.unprocessable('ORDER_RULE_FAILED', '订单规则不满足'), 422, 'ORDER_RULE_FAILED'],
    [ApiError.rateLimited('RATE_LIMITED', '请求过于频繁'), 429, 'RATE_LIMITED'],
  ])('preserves known domain status and code', async (knownError, status, code) => {
    const route = withApiHandler({ policy: 'public' }, async () => {
      throw knownError;
    });

    const response = await route(request());

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });

  it('returns Retry-After for durable rate-limit rejections', async () => {
    const route = withApiHandler({ policy: 'public' }, async () => {
      throw ApiError.rateLimited('RATE_LIMITED', '请求过于频繁', 37);
    });

    const response = await route(request('/api/auth/login'));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('37');
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'RATE_LIMITED',
        message: '请求过于频繁',
        requestId: expect.any(String),
      },
    });
  });

  it('hides unknown exceptions and records a sanitized structured error', async () => {
    const error = vi.fn();
    const route = withApiHandler({
      policy: 'public',
      dependencies: { logger: { error } },
    }, async () => {
      throw new Error('database password=do-not-leak');
    });

    const response = await route(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
    });
    expect(error).toHaveBeenCalledWith('api.unhandled_error', expect.objectContaining({
      requestId: expect.any(String),
      error: expect.any(Error),
    }));
  });
});
