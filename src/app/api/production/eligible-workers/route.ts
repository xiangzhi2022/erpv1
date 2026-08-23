import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseQuery } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const querySchema = z.object({
  task_id: z.string().uuid().optional(),
  task_type: z.string().trim().min(1).max(64).optional(),
  process_name: z.string().trim().min(1).max(120).optional(),
}).strict();

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return jsonError(error.message, error.status);
  console.error('production_eligible_workers.request_failed', { error });
  return jsonError('获取可分配工人失败', 500);
}

export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.assign');
    const input = parseQuery(request, querySchema);
    const supabase = await createClient();
    let taskType = input.task_type ?? '';
    let processName = input.process_name ?? '';
    if (input.task_id) {
      const { data: task, error } = await supabase
        .from('production_tasks')
        .select('task_type,process_name')
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', input.task_id)
        .maybeSingle();
      if (error) {
        console.error('production_eligible_workers.task_lookup_failed', { code: error.code });
        return jsonError('获取可分配工人失败', 500);
      }
      if (!task) return jsonError('生产任务不存在', 404);
      taskType = task.task_type;
      processName = task.process_name ?? '';
    }
    const { data: workers, error } = await supabase
      .from('workers')
      .select('id,name,worker_no,craft_type,workshop_id,skill_tags')
      .eq('enterprise_id', context.enterpriseId)
      .eq('status', 'active')
      .eq('can_receive_production_task', true)
      .order('worker_no', { ascending: true });
    if (error) {
      console.error('production_eligible_workers.query_failed', { code: error.code });
      return jsonError('获取可分配工人失败', 500);
    }
    const matchText = `${taskType} ${processName}`.toLocaleLowerCase();
    const data = (workers ?? []).map((worker) => {
      const tokens = [worker.craft_type, ...(Array.isArray(worker.skill_tags) ? worker.skill_tags.filter((tag): tag is string => typeof tag === 'string') : [])]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .map((value) => value.toLocaleLowerCase());
      const matchReasons = tokens.some((token) => matchText.includes(token)) ? ['工种或技能匹配'] : [];
      return {
        id: worker.id,
        name: worker.name,
        worker_no: worker.worker_no,
        craft_type: worker.craft_type,
        workshop_id: worker.workshop_id,
        score: matchReasons.length ? 1 : 0,
        match_reasons: matchReasons,
      };
    });
    return Response.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
