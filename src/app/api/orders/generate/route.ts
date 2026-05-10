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

// POST /api/orders/generate - Generate order number with atomic sequence
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const prefix = typeof body.prefix === 'string' && body.prefix.trim() ? body.prefix.trim() : 'ORD';

    if (!prefix) {
      return Response.json({ success: false, error: '前缀不能为空' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');

    let query = supabase
      .from('orders')
      .select('order_no')
      .like('order_no', `${prefix}${dateStr}%`)
      .order('order_no', { ascending: false })
      .limit(1);

    if (user.role !== 'super_admin' && user.role !== 'saas_admin') {
      if (!user.tenant_id) {
        return Response.json({ success: false, error: '当前用户未关联租户' }, { status: 403 });
      }
      query = query.eq('tenant_id', user.tenant_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Generate order number error:', error);
      return Response.json({ success: false, error: '生成订单号失败' }, { status: 500 });
    }

    let sequence = 1;
    const lastNo = data?.[0]?.order_no;
    if (lastNo) {
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = lastNo.match(new RegExp(`^${escapedPrefix}${dateStr}(\\d+)$`));
      if (match) {
        sequence = Number.parseInt(match[1], 10) + 1;
      }
    }

    const orderNo = `${prefix}${dateStr}${String(sequence).padStart(3, '0')}`;
    return Response.json({ success: true, data: { order_no: orderNo }, orderNo });
  } catch (err) {
    console.error('Generate order number error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
