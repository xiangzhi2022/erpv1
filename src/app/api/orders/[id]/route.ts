import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { ORDER_STATUS_VALUES, canEditFinancialFields, canEditOrderContent } from '@/lib/four-level-order';
import {
  canMutateOrderContent,
  canSeeOrder,
  loadOrderTree,
  sanitizeOrderTreeForUser,
  writeStatusLog,
} from '@/lib/four-level-order-server';

const PATCHABLE_BASIC_FIELDS = new Set([
  'status',
  'remark',
  'internal_remark',
  'customer_name',
  'customer_phone',
  'customer_address',
  'order_source',
  'delivery_date',
  'target_factory_id',
  'to_tenant_id',
  'parent_order_id',
]);

const PATCHABLE_FINANCE_FIELDS = new Set([
  'total_amount',
  'cost_amount',
  'profit_amount',
  'deposit_amount',
]);

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);

    const { id } = await params;
    const supabase = getSupabaseClient();
    const tree = await loadOrderTree(supabase, id);
    if (!tree) return jsonError('订单不存在', 404);
    if (!canSeeOrder(user, tree)) return jsonError('无权查看该订单', 403);

    return Response.json({ success: true, data: sanitizeOrderTreeForUser(user, tree) });
  } catch (error) {
    console.error('get order detail failed:', error);
    return jsonError('获取订单详情失败', 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const supabase = getSupabaseClient();
    const tree = await loadOrderTree(supabase, id);
    if (!tree) return jsonError('订单不存在', 404);
    if (!canMutateOrderContent(user, tree)) return jsonError('无权操作该订单', 403);

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    Object.keys(body).forEach((key) => {
      if (PATCHABLE_BASIC_FIELDS.has(key) && canEditOrderContent(user)) updateData[key] = body[key];
      if (PATCHABLE_FINANCE_FIELDS.has(key) && canEditFinancialFields(user)) updateData[key] = body[key];
    });

    if (body.status !== undefined) {
      const nextStatus = String(body.status);
      if (!ORDER_STATUS_VALUES.includes(nextStatus as (typeof ORDER_STATUS_VALUES)[number])) {
        return jsonError(`无效订单状态: ${nextStatus}`, 400);
      }
      updateData.status = nextStatus;
    }

    if (typeof body.notes === 'string' && body.notes.trim()) {
      updateData.remark = body.notes.trim();
    }

    if (Object.keys(updateData).length === 1) return jsonError('没有可更新的订单字段', 400);

    const previousStatus = typeof tree.status === 'string' ? tree.status : null;
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);

    if (typeof updateData.status === 'string' && updateData.status !== previousStatus) {
      await writeStatusLog(supabase, 'order', id, previousStatus, updateData.status, user.id, typeof body.notes === 'string' ? body.notes : null);
    }

    if (body.status === 'accepted' || body.status === 'reviewed') {
      await supabase
        .from('order_exchanges')
        .update({
          status: 'accepted',
          handled_by: user.id,
          handled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', id)
        .eq('to_tenant_id', user.tenant_id || tree.to_tenant_id || '')
        .in('status', ['sent', 'change_requested']);
    }

    if (body.status === 'cancelled') {
      await supabase
        .from('order_exchanges')
        .update({
          status: 'cancelled',
          handled_by: user.id,
          handled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', id)
        .in('status', ['sent', 'change_requested']);
    }

    const refreshed = await loadOrderTree(supabase, id);
    return Response.json({ success: true, data: refreshed ? sanitizeOrderTreeForUser(user, refreshed) : data });
  } catch (error) {
    console.error('update order failed:', error);
    return jsonError('更新订单失败', 500);
  }
}
