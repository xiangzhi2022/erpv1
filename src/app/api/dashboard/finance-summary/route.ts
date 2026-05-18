import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canViewFinancialFields } from '@/lib/four-level-order';

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
    if (!canViewFinancialFields(user)) return jsonError('无权查看财务汇总', 403);
    const supabase = getSupabaseClient();
    let ordersQuery = supabase.from('orders').select('total_amount,cost_amount,profit_amount,created_at');
    if (user.tenant_id) ordersQuery = ordersQuery.eq('tenant_id', user.tenant_id);
    const [ordersRes, wagesRes] = await Promise.all([
      ordersQuery,
      supabase.from('worker_wage_records').select('wage_amount,status,created_at'),
    ]);
    if (ordersRes.error) return jsonError(ordersRes.error.message, 500);
    if (wagesRes.error) return jsonError(wagesRes.error.message, 500);
    const orders = (ordersRes.data || []) as Record<string, unknown>[];
    const wages = (wagesRes.data || []) as Record<string, unknown>[];
    return Response.json({
      success: true,
      data: {
        revenue: orders.reduce((sum, order) => sum + num(order.total_amount), 0),
        material_cost: orders.reduce((sum, order) => sum + num(order.cost_amount), 0),
        labor_cost: wages.reduce((sum, wage) => sum + num(wage.wage_amount), 0),
        profit: orders.reduce((sum, order) => sum + num(order.profit_amount), 0),
      },
    });
  } catch (error) {
    console.error('get finance summary failed:', error);
    return jsonError('获取财务汇总失败', 500);
  }
}
