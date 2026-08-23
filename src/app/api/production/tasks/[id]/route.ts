import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseParams } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';
import { callProductionTaskRpc, productionRpcError } from '@/app/api/production/rpc';

const paramsSchema = z.object({ id: z.string().uuid() });
const statusSchema = z.enum(['pending_assign', 'pending_start', 'assigned', 'producing', 'quality_failed', 'reworking', 'submitted', 'pending_quality_check', 'completed', 'abnormal']);
const patchSchema = z.object({
  task_name: z.string().trim().min(1).max(200).optional(),
  task_code: z.string().trim().max(100).nullable().optional(),
  quantity: z.number().finite().positive().optional(),
  unit: z.string().trim().min(1).max(32).optional(),
  length: z.number().finite().nonnegative().nullable().optional(),
  width: z.number().finite().nonnegative().nullable().optional(),
  thickness: z.number().finite().nonnegative().nullable().optional(),
  area: z.number().finite().nonnegative().nullable().optional(),
  material: z.string().trim().max(200).nullable().optional(),
  color: z.string().trim().max(100).nullable().optional(),
  process_name: z.string().trim().max(200).nullable().optional(),
  workshop_id: z.string().uuid().nullable().optional(),
  workstation_id: z.string().uuid().nullable().optional(),
  remark: z.string().trim().max(2000).nullable().optional(),
  status: statusSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, '没有可更新的任务字段');

function jsonError(error: string, status: number) { return Response.json({ success: false, error }, { status }); }
function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return jsonError(error.message, error.status);
  console.error('production_task.update_failed', { error });
  return jsonError('更新生产任务失败', 500);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.plan');
    const { id } = await parseParams(params, paramsSchema);
    const input = await parseJson(request, patchSchema);
    if (input.status) requirePermission(context, 'production.manage');
    const supabase = await createClient();
    const { data, error } = await callProductionTaskRpc(supabase, 'edit_production_task', {
      p_enterprise_id: context.enterpriseId,
      p_task_id: id,
      p_fields: input,
    });
    if (error) {
      const failure = productionRpcError(error, '更新生产任务失败');
      return jsonError(failure.error, failure.status);
    }
    return Response.json({ success: true, data });
  } catch (error) { return errorResponse(error); }
}
