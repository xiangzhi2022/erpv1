import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageProduction, canViewFinancialFields } from '@/lib/four-level-order';

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
    if (!canManageProduction(user) && !canViewFinancialFields(user)) return jsonError('无权查看订单绩效', 403);
    const supabase = getSupabaseClient();
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const [ordersRes, tasksRes, wagesRes] = await Promise.all([
      query,
      user.tenant_id ? supabase.from('production_tasks').select('order_id,status').eq('tenant_id', user.tenant_id) : supabase.from('production_tasks').select('order_id,status'),
      supabase.from('worker_wage_records').select('order_id,wage_amount,status'),
    ]);
    if (ordersRes.error) return jsonError(ordersRes.error.message, 500);
    if (tasksRes.error) return jsonError(tasksRes.error.message, 500);
    if (wagesRes.error) return jsonError(wagesRes.error.message, 500);
    const tasks = (tasksRes.data || []) as Record<string, unknown>[];
    const wages = (wagesRes.data || []) as Record<string, unknown>[];
    const rows = ((ordersRes.data || []) as Record<string, unknown>[]).map((order) => {
      const orderTasks = tasks.filter((task) => task.order_id === order.id);
      const completed = orderTasks.filter((task) => task.status === 'completed').length;
      const abnormal = orderTasks.filter((task) => ['abnormal', 'quality_failed', 'reworking'].includes(String(task.status))).length;
      const laborCost = wages.filter((wage) => wage.order_id === order.id).reduce((sum, wage) => sum + num(wage.wage_amount), 0);
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
        labor_cost: laborCost,
        order_output: num(order.total_amount),
      };
    });
    return Response.json({ success: true, data: rows });
  } catch (error) {
    console.error('get order performance failed:', error);
    return jsonError('获取订单绩效失败', 500);
  }
}
