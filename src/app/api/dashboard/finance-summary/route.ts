import { createClient } from '@/lib/supabase/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';

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
    const [ordersRes, wagesRes] = await Promise.all([
      supabase.from('orders').select('total_amount,cost_amount,profit_amount,created_at').eq('enterprise_id', context.enterpriseId),
      supabase.from('worker_wage_records').select('wage_amount,status,created_at').eq('enterprise_id', context.enterpriseId),
    ]);
    if (ordersRes.error || wagesRes.error) return jsonError('获取财务汇总失败', 500);
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
