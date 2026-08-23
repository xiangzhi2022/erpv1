import { createHash, randomUUID } from 'node:crypto';
import { ApiError, isApiError } from '@/lib/api/errors';
import {
  enforceRateLimit,
  type ConsumeRateLimitOptions,
  type RateLimitResult,
} from '@/lib/security/rate-limit';

type JsonObject = Record<string, unknown>;

interface MutationContext {
  enterpriseId: string;
  userId: string;
}

interface RpcResult {
  data: unknown;
  error: unknown;
}

type Rpc = (functionName: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;

interface IdempotentMutationOptions<TInput> {
  request: Request;
  context: MutationContext;
  input: TInput;
  rpc: Rpc;
  execute: () => Promise<Response>;
  dependencies?: IdempotencyDependencies;
}

interface IdempotencyDependencies {
  enforceRateLimit?: (options: ConsumeRateLimitOptions) => Promise<RateLimitResult>;
}

interface ClaimRow {
  outcome: 'claimed' | 'replay' | 'idempotency_key_reused' | 'idempotency_in_progress';
  response_status: number | null;
  response_body: JsonObject | null;
  claim_token: string | null;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function response(body: JsonObject, status: number): Response {
  return Response.json(body, { status });
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const CRITICAL_MUTATION_USER_BUCKET = 'critical.mutations.user';

function requestId(request: Request): string {
  const candidate = request.headers.get('x-request-id');
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

function rateLimitErrorResponse(request: Request, caught: unknown): Response {
  const error = isApiError(caught)
    ? caught
    : new ApiError('RATE_LIMIT_UNAVAILABLE', 503, '请求频率保护暂时不可用');
  const id = requestId(request);
  const result = Response.json({
    error: {
      code: error.code,
      message: error.message,
      requestId: id,
    },
  }, { status: error.status, headers: error.responseHeaders });
  result.headers.set('x-request-id', id);
  result.headers.set('cache-control', 'no-store');
  return result;
}

function firstRow(data: unknown): ClaimRow | null {
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') return null;
  return data[0] as ClaimRow;
}

export async function executeIdempotentMutation<TInput>({
  request,
  context,
  input,
  rpc,
  execute,
  dependencies,
}: IdempotentMutationOptions<TInput>): Promise<Response> {
  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || new TextEncoder().encode(idempotencyKey).length > 200) {
    return response({ success: false, error: '缺少或无效的 Idempotency-Key' }, 400);
  }

  try {
    await (dependencies?.enforceRateLimit ?? enforceRateLimit)({
      bucket: CRITICAL_MUTATION_USER_BUCKET,
      identifier: context.userId,
      limit: 120,
      windowSeconds: 60,
    });
  } catch (caught) {
    return rateLimitErrorResponse(request, caught);
  }

  const requestHash = createHash('sha256').update(JSON.stringify({
    method: request.method.toUpperCase(),
    path: new URL(request.url).pathname,
    input: canonicalize(input),
  })).digest('hex');
  const claimResult = await rpc('claim_api_idempotency', {
    target_enterprise_id: context.enterpriseId,
    target_idempotency_key: idempotencyKey,
    target_request_hash: requestHash,
  });
  const claim = firstRow(claimResult.data);
  if (claimResult.error || !claim) {
    console.error('api_idempotency.claim_failed', { error: claimResult.error });
    return response({ success: false, error: '请求幂等校验暂时不可用' }, 503);
  }
  if (claim.outcome === 'replay' && claim.response_status && claim.response_body) {
    return response(claim.response_body, claim.response_status);
  }
  if (claim.outcome === 'idempotency_key_reused') {
    return response({ success: false, error: 'Idempotency-Key 已用于不同请求' }, 409);
  }
  if (claim.outcome === 'idempotency_in_progress') {
    return response({ success: false, error: '相同请求正在处理中' }, 409);
  }
  if (claim.outcome !== 'claimed' || !claim.claim_token) {
    return response({ success: false, error: '请求幂等状态无效' }, 503);
  }

  const mutationResponse = await execute();
  let responseBody: JsonObject;
  try {
    const parsed = await mutationResponse.clone().json() as unknown;
    responseBody = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as JsonObject
      : { success: mutationResponse.ok };
  } catch {
    responseBody = { success: mutationResponse.ok };
  }
  const completionResult = await rpc('complete_api_idempotency', {
    target_enterprise_id: context.enterpriseId,
    target_idempotency_key: idempotencyKey,
    target_request_hash: requestHash,
    target_claim_token: claim.claim_token,
    completed_status: mutationResponse.status,
    completed_body: responseBody,
  });
  if (completionResult.error) {
    console.error('api_idempotency.completion_failed', { error: completionResult.error });
  }
  return mutationResponse;
}
