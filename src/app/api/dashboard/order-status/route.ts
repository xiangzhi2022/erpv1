import { createClient } from '@/lib/supabase/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    void request;
    const context = await getEnterpriseContext();
    requirePermission(context, 'dashboard.read');
    const supabase = await createClient();
    const query = supabase.from('orders').select('status').eq('enterprise_id', context.enterpriseId);
    const { data, error } = await query;
    if (error) return jsonError('获取订单状态失败', 500);
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
