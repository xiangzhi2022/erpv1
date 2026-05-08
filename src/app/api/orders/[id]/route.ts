import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';
import { ORDER_STATUSES, STATUS_TRANSITIONS, type OrderStatus } from '@/app/orders/schemas';

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

// Allowed fields for PATCH update (whitelist to prevent overwriting system fields)
const PATCHABLE_ORDER_FIELDS = new Set([
  'status',
  'remark',
  'customer_name',
  'customer_phone',
  'delivery_date',
  'target_factory_id',
]);

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

    let query = supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', id);

    // Permission filter: non-admins can only see their own orders
    if (user.role !== 'super_admin' && user.role !== 'saas_admin') {
      query = query.eq('tenant_id', user.tenant_id || '');
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return Response.json({ success: false, error: '订单不存在或无权查看' }, { status: 404 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Get order detail error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// PATCH /api/orders/[id] - Update order (status transition or field update)
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

    // 1. Fetch current order to verify existence and ownership
    let fetchQuery = supabase
      .from('orders')
      .select('id, status, tenant_id')
      .eq('id', id);

    if (user.role !== 'super_admin' && user.role !== 'saas_admin') {
      fetchQuery = fetchQuery.eq('tenant_id', user.tenant_id || '');
    }

    const { data: existingOrder, error: fetchError } = await fetchQuery.single();

    if (fetchError || !existingOrder) {
      return Response.json({ success: false, error: '订单不存在或无权操作' }, { status: 404 });
    }

    // 2. If status change, validate transition
    if (body.status !== undefined) {
      const newStatus = body.status as string;

      // Validate status value
      if (!ORDER_STATUSES.includes(newStatus as OrderStatus)) {
        return Response.json(
          { success: false, error: `无效的状态值: ${newStatus}` },
          { status: 400 }
        );
      }

      const currentStatus = existingOrder.status as string;
      const allowedTransitions = STATUS_TRANSITIONS[currentStatus];

      if (!allowedTransitions || !allowedTransitions.has(newStatus)) {
        return Response.json(
          { success: false, error: `不允许从「${currentStatus}」变更为「${newStatus}」` },
          { status: 400 }
        );
      }
    }

    // 3. Build safe update payload (whitelist fields only)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const key of Object.keys(body)) {
      if (PATCHABLE_ORDER_FIELDS.has(key)) {
        updateData[key] = body[key];
      }
    }

    // 4. Execute update
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select('*, items:order_items(*)')
      .single();

    if (error) {
      console.error('Update order error:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Update order error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
