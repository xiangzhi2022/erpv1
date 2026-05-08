import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

const getServiceClient = () => getSupabaseClient();

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userStr = cookieStore.get('erp_user')?.value;
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// GET /api/orders/[id] - Get single order with items
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', id)
      .single();

    if (error) {
      return Response.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Get order detail error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// PATCH /api/orders/[id] - Update order
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = getServiceClient();

    const updateData: Record<string, unknown> = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select('*, items:order_items(*)')
      .single();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Update order error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
