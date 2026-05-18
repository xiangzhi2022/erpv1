import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  canAccessProductionTask,
  createOrUpdatePendingWageRecord,
  getWorkerForUser,
  resolveWageRuleForTask,
  writeStatusLog,
} from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

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

    const previousStatus = String(task.status || 'producing');
    if (!['producing', 'quality_failed', 'reworking'].includes(previousStatus)) return jsonError('当前状态不能提交完成', 409);
    const wageRule = await resolveWageRuleForTask(supabase, task as Record<string, unknown>);
    const { data, error } = await supabase
      .from('production_tasks')
      .update({ status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    const wageRecord = await createOrUpdatePendingWageRecord(supabase, data as Record<string, unknown>, wageRule, user.id);
    await writeStatusLog(supabase, 'production_task', id, previousStatus, 'submitted', user.id, '工人提交完成');
    return Response.json({
      success: true,
      data,
      wage_record: wageRecord,
      warning: wageRecord ? null : '工资规则待配置，主管配置后再审核工资',
    });
  } catch (error) {
    console.error('submit task failed:', error);
    return jsonError('提交任务失败', 500);
  }
}
