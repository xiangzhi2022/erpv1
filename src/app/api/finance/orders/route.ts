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
    if (!canViewFinancialFields(user)) return jsonError('无权查看财务订单', 403);
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    let orderQuery = supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (user.tenant_id) orderQuery = orderQuery.eq('tenant_id', user.tenant_id);
    if (status && status !== 'all') orderQuery = orderQuery.eq('status', status);
    const [ordersRes, wagesRes] = await Promise.all([
      orderQuery,
      supabase.from('worker_wage_records').select('order_id, wage_amount, status'),
    ]);
    if (ordersRes.error) return jsonError(ordersRes.error.message, 500);
    if (wagesRes.error) return jsonError(wagesRes.error.message, 500);

    const wages = (wagesRes.data || []) as Record<string, unknown>[];
    const rows = ((ordersRes.data || []) as Record<string, unknown>[]).map((order) => {
      const orderWages = wages.filter((wage) => wage.order_id === order.id);
      const laborCost = orderWages.reduce((sum, wage) => sum + num(wage.wage_amount), 0);
      const saleAmount = num(order.total_amount);
      const materialCost = num(order.material_cost);
      const hardwareCost = num(order.hardware_cost);
      const recordedCost = num(order.cost_amount);
      const totalCost = recordedCost || materialCost + hardwareCost + laborCost;
      return {
        ...order,
        labor_cost: laborCost,
        total_cost: totalCost,
        profit: saleAmount - totalCost,
        receivable_amount: saleAmount,
        payable_amount: totalCost,
      };
    });
    return Response.json({ success: true, data: rows });
  } catch (error) {
    console.error('get finance orders failed:', error);
    return jsonError('获取财务订单失败', 500);
  }
}
