import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { EnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';
import { numeric, performanceError } from '../_lib';

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    requirePermission(context, 'wages.read.all');
    if (!hasEnterprisePermission(context, 'wages.read.all')) {
      throw new EnterpriseAccessError('ENTERPRISE_PERMISSION_DENIED', 403, '没有执行该操作的权限');
    }
    const supabase = await createClient();
    const [workersResult, tasksResult, wagesResult] = await Promise.all([
      supabase.from('workers')
        .select('id,name,worker_no,craft_type,status,workshop_id')
        .eq('enterprise_id', context.enterpriseId),
      supabase.from('production_tasks')
        .select('assigned_worker_id,worker_id,status,quantity')
        .eq('enterprise_id', context.enterpriseId),
      supabase.from('worker_wage_records')
        .select('worker_id,wage_amount,status,created_at')
        .eq('enterprise_id', context.enterpriseId),
    ]);
    if (workersResult.error || tasksResult.error || wagesResult.error) {
      console.error('performance.workers_query_failed', {
        workers: workersResult.error?.code,
        tasks: tasksResult.error?.code,
        wages: wagesResult.error?.code,
      });
      return Response.json({ success: false, error: '获取绩效失败' }, { status: 500 });
    }
    const tasks = tasksResult.data ?? [];
    const wages = wagesResult.data ?? [];
    const workers = (workersResult.data ?? []).map((worker) => {
      const workerTasks = tasks.filter((task) => (
        task.assigned_worker_id === worker.id || task.worker_id === worker.id
      ));
      const completedTasks = workerTasks.filter((task) => task.status === 'completed');
      const workerWages = wages.filter((wage) => wage.worker_id === worker.id);
      return {
        ...worker,
        task_count: workerTasks.length,
        completed_task_count: completedTasks.length,
        rework_count: workerTasks.filter((task) => (
          task.status === 'reworking' || task.status === 'quality_failed'
        )).length,
        output_quantity: completedTasks.reduce((sum, task) => sum + numeric(task.quantity), 0),
        pending_wage: workerWages
          .filter((wage) => wage.status === 'pending')
          .reduce((sum, wage) => sum + numeric(wage.wage_amount), 0),
        approved_wage: workerWages
          .filter((wage) => wage.status === 'approved' || wage.status === 'paid')
          .reduce((sum, wage) => sum + numeric(wage.wage_amount), 0),
      };
    });
    return Response.json({
      success: true,
      data: workers,
      summary: {
        workers: workers.length,
        tasks: tasks.length,
        completed_tasks: tasks.filter((task) => task.status === 'completed').length,
        pending_wage: workers.reduce((sum, worker) => sum + worker.pending_wage, 0),
        approved_wage: workers.reduce((sum, worker) => sum + worker.approved_wage, 0),
      },
    });
  } catch (error) {
    return performanceError(error, '获取绩效失败');
  }
}
