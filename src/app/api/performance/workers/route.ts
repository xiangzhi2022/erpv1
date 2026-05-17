import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canViewWageSummary } from '@/lib/four-level-order';

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
    if (!canViewWageSummary(user)) return jsonError('无权查看绩效', 403);
    const supabase = getSupabaseClient();
    let workerQuery = supabase.from('workers').select('id, name, worker_no, craft_type, tenant_id, status');
    if (user.tenant_id) workerQuery = workerQuery.eq('tenant_id', user.tenant_id);
    const [workersRes, taskRes, wageRes] = await Promise.all([
      workerQuery,
      user.tenant_id ? supabase.from('production_tasks').select('assigned_worker_id, worker_id, status, quantity, tenant_id').eq('tenant_id', user.tenant_id) : supabase.from('production_tasks').select('assigned_worker_id, worker_id, status, quantity, tenant_id'),
      supabase.from('worker_wage_records').select('worker_id, wage_amount, status, created_at'),
    ]);
    if (workersRes.error) return jsonError(workersRes.error.message, 500);
    if (taskRes.error) return jsonError(taskRes.error.message, 500);
    if (wageRes.error) return jsonError(wageRes.error.message, 500);

    const tasks = (taskRes.data || []) as Record<string, unknown>[];
    const wages = (wageRes.data || []) as Record<string, unknown>[];
    const workers = ((workersRes.data || []) as Record<string, unknown>[]).map((worker) => {
      const workerId = String(worker.id);
      const workerTasks = tasks.filter((task) => task.assigned_worker_id === workerId || task.worker_id === workerId);
      const workerWages = wages.filter((wage) => wage.worker_id === workerId);
      const completedTasks = workerTasks.filter((task) => task.status === 'completed');
      return {
        ...worker,
        task_count: workerTasks.length,
        completed_task_count: completedTasks.length,
        rework_count: workerTasks.filter((task) => task.status === 'reworking' || task.status === 'quality_failed').length,
        output_quantity: completedTasks.reduce((sum, task) => sum + num(task.quantity), 0),
        pending_wage: workerWages.filter((wage) => wage.status === 'pending').reduce((sum, wage) => sum + num(wage.wage_amount), 0),
        approved_wage: workerWages.filter((wage) => wage.status === 'approved' || wage.status === 'paid').reduce((sum, wage) => sum + num(wage.wage_amount), 0),
      };
    });
    const summary = {
      workers: workers.length,
      tasks: tasks.length,
      completed_tasks: tasks.filter((task) => task.status === 'completed').length,
      pending_wage: workers.reduce((sum, worker) => sum + num(worker.pending_wage), 0),
      approved_wage: workers.reduce((sum, worker) => sum + num(worker.approved_wage), 0),
    };
    return Response.json({ success: true, data: workers, summary });
  } catch (error) {
    console.error('get worker performance failed:', error);
    return jsonError('获取绩效失败', 500);
  }
}
