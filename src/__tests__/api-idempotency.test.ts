import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { executeIdempotentMutation } from '@/lib/api/idempotency';

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

  it('rejects a missing idempotency key before executing the mutation', async () => {
    const rpc = vi.fn();
    const execute = vi.fn();

    const response = await executeIdempotentMutation({
      request: request(),
      context,
      input: { value: 1 },
      rpc,
      execute,
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
    });

    expect(response.status).toBe(409);
  });
});
