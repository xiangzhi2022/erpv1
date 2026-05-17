import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  calculateTaskWage,
  canManageProduction,
  isProductionTaskStatus,
  isProductionTaskType,
} from '@/lib/four-level-order';
import {
  canAccessProductionTask,
  getWorkerForUser,
  resolveWageRuleForTask,
  syncOrderProgressFromTask,
  writeStatusLog,
} from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

const PATCH_FIELDS = ['task_name', 'task_code', 'quantity', 'unit', 'length', 'width', 'thickness', 'area', 'material', 'color', 'process_name', 'workshop_id', 'workstation_id', 'wage_rule_id', 'remark'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    const { id } = await params;
    const supabase = getSupabaseClient();
    const { data: task } = await supabase.from('production_tasks').select('*').eq('id', id).maybeSingle();
    if (!task) return jsonError('生产任务不存在', 404);
    const worker = await getWorkerForUser(supabase, user);
    if (!canAccessProductionTask(user, task as Record<string, unknown>, worker)) return jsonError('无权操作该任务', 403);
    if (!canManageProduction(user)) return jsonError('只有生产管理层可以编辑任务基础信息', 403);

    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    PATCH_FIELDS.forEach((key) => {
      if (body[key] !== undefined) updateData[key] = body[key];
    });
    if (typeof body.task_type === 'string') {
      if (!isProductionTaskType(body.task_type)) return jsonError('任务类型无效', 400);
      updateData.task_type = body.task_type;
    }
    if (typeof body.status === 'string') {
      if (!isProductionTaskStatus(body.status)) return jsonError('任务状态无效', 400);
      updateData.status = body.status;
    }

    const mergedTask = { ...(task as Record<string, unknown>), ...updateData };
    const wageRule = await resolveWageRuleForTask(supabase, mergedTask);
    if (wageRule) updateData.estimated_wage_amount = calculateTaskWage(mergedTask, wageRule);

    const previousStatus = typeof task.status === 'string' ? task.status : null;
    const { data, error } = await supabase.from('production_tasks').update(updateData).eq('id', id).select().single();
    if (error) return jsonError(error.message, 500);
    if (typeof updateData.status === 'string' && updateData.status !== previousStatus) {
      await writeStatusLog(supabase, 'production_task', id, previousStatus, updateData.status, user.id, '更新任务状态');
      await syncOrderProgressFromTask(supabase, id, user.id, '更新任务状态');
    }
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update production task failed:', error);
    return jsonError('更新生产任务失败', 500);
  }
}
