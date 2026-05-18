import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageProduction } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageProduction(user)) return jsonError('无权查看生产绩效', 403);
    const supabase = getSupabaseClient();
    let query = supabase.from('production_tasks').select('task_type,process_name,workstation_id,status,quantity,created_at,completed_at');
    if (user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    const tasks = (data || []) as Record<string, unknown>[];
    const byProcess = new Map<string, number>();
    const byWorkstation = new Map<string, number>();
    for (const task of tasks) {
      const process = String(task.process_name || task.task_type || '未分类');
      byProcess.set(process, (byProcess.get(process) || 0) + num(task.quantity));
      const workstation = String(task.workstation_id || '未分配工位');
      byWorkstation.set(workstation, (byWorkstation.get(workstation) || 0) + 1);
    }
    const abnormal = tasks.filter((task) => ['abnormal', 'quality_failed'].includes(String(task.status))).length;
    const rework = tasks.filter((task) => task.status === 'reworking').length;
    return Response.json({
      success: true,
      data: {
        process_output: Array.from(byProcess.entries()).map(([name, value]) => ({ name, value })),
        workstation_tasks: Array.from(byWorkstation.entries()).map(([name, value]) => ({ name, value })),
        rework_rate: tasks.length ? rework / tasks.length : 0,
        abnormal_rate: tasks.length ? abnormal / tasks.length : 0,
        pending_assign: tasks.filter((task) => task.status === 'pending_assign').length,
        producing: tasks.filter((task) => task.status === 'producing').length,
        completed: tasks.filter((task) => task.status === 'completed').length,
        total: tasks.length,
      },
    });
  } catch (error) {
    console.error('get production performance failed:', error);
    return jsonError('获取生产绩效失败', 500);
  }
}
