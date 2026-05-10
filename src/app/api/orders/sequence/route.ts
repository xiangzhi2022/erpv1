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

// GET /api/orders/sequence - Get next order sequence number for current tenant
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || 'ORD';
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Build query with tenant scope
    let query = supabase
      .from('orders')
      .select('order_no')
      .like('order_no', `${prefix}${dateStr}%`)
      .order('order_no', { ascending: false })
      .limit(1);

    // Non-platform users are scoped by tenant_id.
    // are scoped by tenant_id instead of per-user ownership.
    if (user.role !== 'super_admin' && user.role !== 'saas_admin') {
      if (!user.tenant_id) {
        return Response.json({ success: false, error: '当前用户未关联租户' }, { status: 403 });
      }
      query = query.eq('tenant_id', user.tenant_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('获取订单序号失败:', error);
      return Response.json({ success: false, error: '获取订单序号失败' }, { status: 500 });
    }

    let sequence = 1;
    if (data && data.length > 0) {
      const lastNo = data[0].order_no;
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = lastNo.match(new RegExp(`^${escapedPrefix}${dateStr}(\\d+)$`));
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    const orderNo = `${prefix}${dateStr}${String(sequence).padStart(3, '0')}`;

    return Response.json({
      success: true,
      data: { order_no: orderNo, prefix, date: dateStr, sequence },
      orderNo,
      prefix,
      date: dateStr,
      sequence,
    });
  } catch (err) {
    console.error('获取订单序号失败:', err);
    return Response.json({ success: false, error: '获取订单序号失败' }, { status: 500 });
  }
}
