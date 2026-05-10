import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';

const getServiceClient = () => getSupabaseClient();

// GET /api/orders/prefix - Get order prefix config for current tenant
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const tenantId = user.tenant_id;
    if (!tenantId) {
      return Response.json({ success: false, error: '当前用户未关联租户' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('order_prefixes')
      .select('prefix')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return default prefix if no config found
      return Response.json({
        success: true,
        data: { prefix: 'ORD' },
        prefix: 'ORD',
      });
    }

    return Response.json({
      success: true,
      data: { prefix: data.prefix },
      prefix: data.prefix,
    });
  } catch (err) {
    console.error('获取订单前缀失败:', err);
    return Response.json({ success: false, error: '获取订单前缀失败' }, { status: 500 });
  }
}
