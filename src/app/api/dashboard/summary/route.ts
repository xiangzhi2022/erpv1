import { createClient } from '@/lib/supabase/server';
import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  try {
    void request;
    const context = await getEnterpriseContext();
    requirePermission(context, 'dashboard.read');
    const supabase = await createClient();
    const [ordersRes, tasksRes] = await Promise.all([
      supabase.from('orders').select('id,status,total_amount,created_at,delivery_date').eq('enterprise_id', context.enterpriseId),
      supabase.from('production_tasks').select('id,status,quantity,created_at').eq('enterprise_id', context.enterpriseId),
    ]);
    if (ordersRes.error || tasksRes.error) return jsonError('获取看板汇总失败', 500);
    const financeRes = hasEnterprisePermission(context, 'finance.read')
      ? await supabase.rpc('finance_list_order_summaries', {
          target_enterprise_id: context.enterpriseId,
        })
      : { data: [], error: null };
    const wagesRes = hasEnterprisePermission(context, 'wages.read.all')
      ? await supabase.from('worker_wage_records').select('wage_amount,status,created_at').eq('enterprise_id', context.enterpriseId)
      : { data: [], error: null };
    if (financeRes.error || wagesRes.error) return jsonError('获取看板汇总失败', 500);
    const orders = (ordersRes.data || []) as Record<string, unknown>[];
    const financeOrders = (financeRes.data || []) as Record<string, unknown>[];
    const tasks = (tasksRes.data || []) as Record<string, unknown>[];
    const wages = (wagesRes.data || []) as Record<string, unknown>[];
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return Response.json({
      success: true,
      data: {
        today_orders: orders.filter((order) => String(order.created_at || '').startsWith(todayPrefix)).length,
        month_orders: orders.filter((order) => String(order.created_at || '').startsWith(monthPrefix)).length,
        producing_orders: orders.filter((order) => order.status === 'producing').length,
        ready_to_ship_orders: orders.filter((order) => order.status === 'ready_to_ship').length,
        abnormal_orders: orders.filter((order) => order.status === 'abnormal').length,
        month_output: orders.filter((order) => String(order.created_at || '').startsWith(monthPrefix)).reduce((sum, order) => sum + num(order.total_amount), 0),
        month_labor_cost: wages.filter((wage) => String(wage.created_at || '').startsWith(monthPrefix)).reduce((sum, wage) => sum + num(wage.wage_amount), 0),
        month_material_cost: financeOrders.filter((order) => String(order.created_at || '').startsWith(monthPrefix)).reduce((sum, order) => sum + num(order.cost_amount), 0),
        month_profit: financeOrders.filter((order) => String(order.created_at || '').startsWith(monthPrefix)).reduce((sum, order) => sum + num(order.profit_amount), 0),
        pending_tasks: tasks.filter((task) => ['pending_generate', 'pending_assign', 'assigned'].includes(String(task.status))).length,
        producing_tasks: tasks.filter((task) => task.status === 'producing').length,
        completed_tasks: tasks.filter((task) => task.status === 'completed').length,
      },
    });
  } catch (error) {
    console.error('get dashboard summary failed:', error);
    return jsonError('获取看板汇总失败', 500);
  }
}
