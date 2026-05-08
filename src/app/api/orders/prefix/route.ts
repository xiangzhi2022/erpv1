import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

const getServiceClient = () => getSupabaseClient();

interface CurrentUser {
  id: string;
  role: string;
  tenant_id?: string;
}

async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const userStr = cookieStore.get('erp_user')?.value;
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// GET /api/orders/prefix - Get order prefix config for current tenant
export async function GET() {
  try {
    const user = await getCurrentUser();
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
