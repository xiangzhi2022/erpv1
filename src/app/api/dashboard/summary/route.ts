import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageProduction, canViewFinancialFields } from '@/lib/four-level-order';
import { isSuperAdmin } from '@/lib/role-access';

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
    if (!isSuperAdmin(user) && !canManageProduction(user) && !canViewFinancialFields(user)) return jsonError('无权查看看板', 403);
    const supabase = getSupabaseClient();
    let orderQuery = supabase.from('orders').select('id,status,total_amount,cost_amount,profit_amount,created_at,delivery_date');
    let taskQuery = supabase.from('production_tasks').select('id,status,quantity,created_at');
    if (user.tenant_id) {
      orderQuery = orderQuery.eq('tenant_id', user.tenant_id);
      taskQuery = taskQuery.eq('tenant_id', user.tenant_id);
    }
    const [ordersRes, tasksRes, wagesRes] = await Promise.all([
      orderQuery,
      taskQuery,
      supabase.from('worker_wage_records').select('wage_amount,status,created_at'),
    ]);
    if (ordersRes.error) return jsonError(ordersRes.error.message, 500);
    if (tasksRes.error) return jsonError(tasksRes.error.message, 500);
    if (wagesRes.error) return jsonError(wagesRes.error.message, 500);
    const orders = (ordersRes.data || []) as Record<string, unknown>[];
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
        month_material_cost: orders.filter((order) => String(order.created_at || '').startsWith(monthPrefix)).reduce((sum, order) => sum + num(order.cost_amount), 0),
        month_profit: orders.filter((order) => String(order.created_at || '').startsWith(monthPrefix)).reduce((sum, order) => sum + num(order.profit_amount), 0),
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
