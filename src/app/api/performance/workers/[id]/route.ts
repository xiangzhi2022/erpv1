import { z } from 'zod';
import { parseParams } from '@/lib/api/request';
import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { EnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';
import { performanceError } from '../../_lib';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    requirePermission(context, 'wages.read.all');
    if (!hasEnterprisePermission(context, 'wages.read.all')) {
      throw new EnterpriseAccessError('ENTERPRISE_PERMISSION_DENIED', 403, '没有执行该操作的权限');
    }
    const { id } = await parseParams(params, paramsSchema);
    const supabase = await createClient();
    const { data: worker, error: workerError } = await supabase.from('workers')
      .select('id,name,worker_no,craft_type,status,workshop_id,hire_date')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (workerError) {
      console.error('performance.worker_query_failed', { code: workerError.code });
      return Response.json({ success: false, error: '获取绩效详情失败' }, { status: 500 });
    }
    if (!worker) return Response.json({ success: false, error: '工人不存在' }, { status: 404 });
    const [tasksResult, wagesResult] = await Promise.all([
      supabase.from('production_tasks')
        .select('id,task_no,task_name,task_type,product_name,status,quantity,unit,completed,created_at,completed_at')
        .eq('enterprise_id', context.enterpriseId)
        .or(`assigned_worker_id.eq.${id},worker_id.eq.${id}`)
        .order('created_at', { ascending: false }),
      supabase.from('worker_wage_records')
        .select('id,task_id,order_id,quantity,unit_price,wage_amount,status,submitted_at,approved_at,paid_at,created_at')
        .eq('enterprise_id', context.enterpriseId)
        .eq('worker_id', id)
        .order('created_at', { ascending: false }),
    ]);
    if (tasksResult.error || wagesResult.error) {
      console.error('performance.worker_detail_query_failed', {
        tasks: tasksResult.error?.code,
        wages: wagesResult.error?.code,
      });
      return Response.json({ success: false, error: '获取绩效详情失败' }, { status: 500 });
    }
    return Response.json({
      success: true,
      worker,
      tasks: tasksResult.data ?? [],
      wages: wagesResult.data ?? [],
    });
  } catch (error) {
    return performanceError(error, '获取绩效详情失败');
  }
}
