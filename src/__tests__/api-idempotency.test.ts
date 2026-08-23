import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { executeIdempotentMutation } from '@/lib/api/idempotency';

vi.mock('server-only', () => ({}));

const context = {
  enterpriseId: '10000000-0000-4000-8000-000000000001',
  userId: 'a0000000-0000-4000-8000-000000000001',
};

function request(key?: string) {
  return new Request('https://erp.example.test/api/example', {
    method: 'POST',
    headers: key ? { 'Idempotency-Key': key } : undefined,
  });
}

const allowRateLimit = vi.fn().mockResolvedValue({
  allowed: true,
  remaining: 119,
  retryAfterSeconds: 0,
});

function rateLimitDependencies() {
  return { enforceRateLimit: allowRateLimit };
}

describe('API mutation idempotency', () => {
  it('wraps every state-changing production and money handler', () => {
    const routeFiles = [
      'src/app/api/finance/orders/[id]/pricing/route.ts',
      'src/app/api/finance/settlements/route.ts',
      'src/app/api/finance/wage-records/[id]/pay/route.ts',
      'src/app/api/finance/wage-records/[id]/settle/route.ts',
      'src/app/api/production/tasks/[id]/approve/route.ts',
      'src/app/api/production/tasks/[id]/assign/route.ts',
      'src/app/api/production/tasks/[id]/route.ts',
      'src/app/api/production/tasks/[id]/start/route.ts',
      'src/app/api/production/tasks/[id]/submit/route.ts',
      'src/app/api/progress/report/route.ts',
      'src/app/api/progress/work-orders/route.ts',
      'src/app/api/wage-records/[id]/route.ts',
      'src/app/api/wage-rules/[id]/route.ts',
      'src/app/api/wage-rules/route.ts',
      'src/app/api/worker/report/route.ts',
    ];
    const offenders = routeFiles.filter((file) => !readFileSync(resolve(process.cwd(), file), 'utf8')
      .includes('executeIdempotentMutation'));

    expect(offenders).toEqual([]);

    const bucketOverrides = routeFiles.filter((file) => {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      return source.includes('rateLimitBucket');
    });
    expect(bucketOverrides).toEqual([]);
  });

  it('exposes authenticated wrappers without exposing private idempotency functions', () => {
    const migration = readFileSync(resolve(
      process.cwd(),
      'supabase/migrations/20260823110000_api_idempotency_rpc.sql',
    ), 'utf8');

    expect(migration).toMatch(/create function public\.claim_api_idempotency/);
    expect(migration).toMatch(/create function public\.complete_api_idempotency/);
    expect(migration).toMatch(/app_private\.is_active_member\(target_enterprise_id\)/);
    expect(migration).toMatch(/grant execute on function public\.claim_api_idempotency[\s\S]*to authenticated/);
    expect(migration).toMatch(/revoke all on function app_private\.claim_idempotency[\s\S]*from public, anon, authenticated/);
  });

  it('consumes review rate limits only in the shared approve handler', () => {
    const delegatedRoutes = [
      'src/app/api/production/tasks/[id]/abnormal/route.ts',
      'src/app/api/production/tasks/[id]/review/route.ts',
      'src/app/api/production/tasks/[id]/rework/route.ts',
    ];
    for (const file of delegatedRoutes) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('approveTask');
      expect(source).not.toContain('executeIdempotentMutation');
      expect(source).not.toContain('enforceRateLimit');
    }
  });

  it('rejects a missing idempotency key before executing the mutation', async () => {
    const rpc = vi.fn();
    const execute = vi.fn();

    const response = await executeIdempotentMutation({
      request: request(),
      context,
      input: { value: 1 },
      rpc,
      execute,
      dependencies: rateLimitDependencies(),
    });

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('replays a completed response without executing the mutation', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({
      data: [{ outcome: 'replay', response_status: 201, response_body: { success: true, id: 'saved' }, claim_token: null }],
      error: null,
    });
    const execute = vi.fn();

    const response = await executeIdempotentMutation({
      request: request('same-operation'),
      context,
      input: { value: 1 },
      rpc,
      execute,
      dependencies: rateLimitDependencies(),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true, id: 'saved' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('claims, executes, and completes a mutation with the same request hash', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: [{ outcome: 'claimed', response_status: null, response_body: null, claim_token: 'c0000000-0000-4000-8000-000000000001' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ outcome: 'completed', response_status: 200, response_body: { success: true } }],
        error: null,
      });
    const execute = vi.fn().mockResolvedValue(Response.json({ success: true }));

    const response = await executeIdempotentMutation({
      request: request('new-operation'),
      context,
      input: { nested: { b: 2, a: 1 } },
      rpc,
      execute,
      dependencies: rateLimitDependencies(),
    });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledTimes(2);
    const claimArgs = rpc.mock.calls[0][1];
    const completeArgs = rpc.mock.calls[1][1];
    expect(claimArgs.target_request_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(completeArgs.target_request_hash).toBe(claimArgs.target_request_hash);
  });

  it.each(['idempotency_key_reused', 'idempotency_in_progress'])('returns a conflict for %s', async (outcome) => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ outcome, response_status: null, response_body: null, claim_token: null }],
      error: null,
    });

    const response = await executeIdempotentMutation({
      request: request('conflicting-operation'),
      context,
      input: { value: 1 },
      rpc,
      execute: vi.fn(),
      dependencies: rateLimitDependencies(),
    });

    expect(response.status).toBe(409);
  });

  it('enforces one shared user bucket across distinct routes before claiming idempotency', async () => {
    const events: string[] = [];
    const enforceRateLimit = vi.fn().mockImplementation(async () => {
      events.push('rate-limit');
      return { allowed: true, remaining: 119, retryAfterSeconds: 0 };
    });
    const rpc = vi.fn().mockImplementation(async () => {
      events.push('claim');
      return {
        data: [{ outcome: 'replay', response_status: 200, response_body: { data: {} }, claim_token: null }],
        error: null,
      };
    });

    for (const path of ['/api/production/tasks/one/start', '/api/finance/settlements']) {
      await executeIdempotentMutation({
        request: new Request(`https://erp.example.test${path}`, {
          method: 'POST',
          headers: { 'Idempotency-Key': `operation-${path}` },
        }),
        context,
        input: { value: 1 },
        rpc,
        execute: vi.fn(),
        dependencies: { enforceRateLimit },
      });
    }

    expect(events).toEqual(['rate-limit', 'claim', 'rate-limit', 'claim']);
    expect(enforceRateLimit).toHaveBeenCalledTimes(2);
    for (const [options] of enforceRateLimit.mock.calls) {
      expect(options).toEqual({
        bucket: 'critical.mutations.user',
        identifier: context.userId,
        limit: 120,
        windowSeconds: 60,
      });
    }
  });

  it('returns the standard 429 envelope without claiming or executing', async () => {
    const rpc = vi.fn();
    const execute = vi.fn();
    const response = await executeIdempotentMutation({
      request: new Request('https://erp.example.test/api/example', {
        method: 'POST',
        headers: {
          'Idempotency-Key': 'limited-operation',
          'x-request-id': 'idempotency-request-1',
        },
      }),
      context,
      input: { value: 1 },
      rpc,
      execute,
      dependencies: {
        enforceRateLimit: vi.fn().mockRejectedValue(new ApiError(
          'RATE_LIMITED',
          429,
          '请求过于频繁',
          undefined,
          { 'retry-after': '37' },
        )),
      },
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: '请求过于频繁',
        requestId: 'idempotency-request-1',
      },
    });
    expect(response.headers.get('retry-after')).toBe('37');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('idempotency-request-1');
    expect(rpc).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
