import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';
import { numeric, performanceError } from '../_lib';

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const supabase = await createClient();
    const { data, error } = await supabase.from('production_tasks')
      .select('task_type,process_name,workstation_id,status,quantity,created_at,completed_at')
      .eq('enterprise_id', context.enterpriseId);
    if (error) {
      console.error('performance.production_query_failed', { code: error.code });
      return Response.json({ success: false, error: '获取生产绩效失败' }, { status: 500 });
    }
    const tasks = data ?? [];
    const byProcess = new Map<string, number>();
    const byWorkstation = new Map<string, number>();
    for (const task of tasks) {
      const process = task.process_name || task.task_type || '未分类';
      byProcess.set(process, (byProcess.get(process) ?? 0) + numeric(task.quantity));
      const workstation = task.workstation_id || '未分配工位';
      byWorkstation.set(workstation, (byWorkstation.get(workstation) ?? 0) + 1);
    }
    const abnormal = tasks.filter((task) => ['abnormal', 'quality_failed'].includes(task.status)).length;
    const rework = tasks.filter((task) => task.status === 'reworking').length;
    return Response.json({
      success: true,
      data: {
        process_output: Array.from(byProcess, ([name, value]) => ({ name, value })),
        workstation_tasks: Array.from(byWorkstation, ([name, value]) => ({ name, value })),
        rework_rate: tasks.length ? rework / tasks.length : 0,
        abnormal_rate: tasks.length ? abnormal / tasks.length : 0,
        pending_assign: tasks.filter((task) => task.status === 'pending_assign').length,
        producing: tasks.filter((task) => task.status === 'producing').length,
        completed: tasks.filter((task) => task.status === 'completed').length,
        total: tasks.length,
      },
    });
  } catch (error) {
    return performanceError(error, '获取生产绩效失败');
  }
}
