import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageProduction, canViewFinancialFields } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageProduction(user) && !canViewFinancialFields(user)) return jsonError('无权查看订单状态', 403);
    const supabase = getSupabaseClient();
    let query = supabase.from('orders').select('status');
    if (user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    const rows = (data || []) as Array<{ status?: string }>;
    const status = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Response.json({ success: true, data: Object.entries(status).map(([name, value]) => ({ name, value })) });
  } catch (error) {
    console.error('get dashboard order status failed:', error);
    return jsonError('获取订单状态失败', 500);
  }
}
