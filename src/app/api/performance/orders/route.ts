import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { EnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';
import { numeric, performanceError } from '../_lib';

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.read');
    requirePermission(context, 'production.read');
    requirePermission(context, 'wages.read.all');
    if (!hasEnterprisePermission(context, 'wages.read.all')) {
      throw new EnterpriseAccessError('ENTERPRISE_PERMISSION_DENIED', 403, '没有执行该操作的权限');
    }
    const supabase = await createClient();
    const [ordersResult, tasksResult, wagesResult] = await Promise.all([
      supabase.from('orders')
        .select('id,order_no,customer_name,dealer_id,status,delivery_date,updated_at,total_amount')
        .eq('enterprise_id', context.enterpriseId)
        .order('created_at', { ascending: false }),
      supabase.from('production_tasks')
        .select('order_id,status')
        .eq('enterprise_id', context.enterpriseId),
      supabase.from('worker_wage_records')
        .select('order_id,wage_amount,status')
        .eq('enterprise_id', context.enterpriseId),
    ]);
    if (ordersResult.error || tasksResult.error || wagesResult.error) {
      console.error('performance.orders_query_failed', {
        orders: ordersResult.error?.code,
        tasks: tasksResult.error?.code,
        wages: wagesResult.error?.code,
      });
      return Response.json({ success: false, error: '获取订单绩效失败' }, { status: 500 });
    }
    const tasks = tasksResult.data ?? [];
    const wages = wagesResult.data ?? [];
    const rows = (ordersResult.data ?? []).map((order) => {
      const orderTasks = tasks.filter((task) => task.order_id === order.id);
      const completed = orderTasks.filter((task) => task.status === 'completed').length;
      const abnormal = orderTasks.filter((task) => (
        ['abnormal', 'quality_failed', 'reworking'].includes(task.status)
      )).length;
      return {
        id: order.id,
        order_no: order.order_no,
        customer_name: order.customer_name,
        dealer_id: order.dealer_id,
        status: order.status,
        progress_percent: orderTasks.length ? Math.round((completed / orderTasks.length) * 100) : 0,
        expected_delivery_date: order.delivery_date,
        actual_completed_at: order.updated_at,
        delayed: false,
        abnormal_count: abnormal,
        labor_cost: wages
          .filter((wage) => wage.order_id === order.id)
          .reduce((sum, wage) => sum + numeric(wage.wage_amount), 0),
        order_output: numeric(order.total_amount),
      };
    });
    return Response.json({ success: true, data: rows });
  } catch (error) {
    return performanceError(error, '获取订单绩效失败');
  }
}
