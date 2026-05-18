import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canAccessProductionTask, getWorkerForUser, syncOrderProgressFromTask, writeStatusLog } from '@/lib/four-level-order-server';

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
    const previousStatus = String(task.status || 'assigned');
    if (!['assigned', 'pending_start', 'pending_assign'].includes(previousStatus)) return jsonError('当前状态不能开始生产', 409);
    const { data, error } = await supabase
      .from('production_tasks')
      .update({ status: 'producing', started_at: new Date().toISOString(), start_date: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    await writeStatusLog(supabase, 'production_task', id, previousStatus, 'producing', user.id, '开始生产');
    await syncOrderProgressFromTask(supabase, id, user.id, '任务开始生产');
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('start task failed:', error);
    return jsonError('开始任务失败', 500);
  }
}
