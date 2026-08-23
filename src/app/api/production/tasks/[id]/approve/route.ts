import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { executeIdempotentMutation } from '@/lib/api/idempotency';
import { parseJson, parseParams } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';
import { callProductionTaskRpc, productionRpcError } from '@/app/api/production/rpc';

const paramsSchema = z.object({ id: z.string().uuid() });
const inputSchema = z.object({
  approved: z.boolean().optional(),
  action: z.enum(['approve', 'rework', 'abnormal']).optional(),
  remark: z.string().trim().max(2000).nullable().optional(),
}).strict();
interface IdempotencyRpcClient { rpc(functionName: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>; }

function jsonError(error: string, status: number) { return Response.json({ success: false, error }, { status }); }
function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return jsonError(error.message, error.status);
  console.error('production_task.review_failed', { error });
  return jsonError('审核任务失败', 500);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.review');
    const { id } = await parseParams(params, paramsSchema);
    const input = await parseJson(request, inputSchema);
    const action = input.action ?? (input.approved === false ? 'rework' : 'approve');
    const supabase = await createClient();
    const rpc = (functionName: string, args: Record<string, unknown>) => (supabase as unknown as IdempotencyRpcClient).rpc(functionName, args);
    return await executeIdempotentMutation({
      request,
      context,
      input: { task_id: id, action, body: input },
      rpc,
      execute: async () => {
        const { data, error } = await callProductionTaskRpc(supabase, 'review_production_task', {
          p_enterprise_id: context.enterpriseId,
          p_task_id: id,
          p_action: action,
          p_remark: input.remark ?? null,
        });
        if (error) {
          const failure = productionRpcError(error, '审核任务失败');
          return jsonError(failure.error, failure.status);
        }
        return Response.json({ success: true, data });
      },
    });
  } catch (error) { return errorResponse(error); }
}
