import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  canActOnExchange,
  canSeeExchange,
  isValidOrderExchangeStatus,
  nextExchangeStatus,
  type OrderExchangeAction,
  type OrderExchangeStatus,
} from '@/lib/order-exchange';

interface ExchangeRow {
  id: string;
  order_id: string;
  from_tenant_id: string;
  to_tenant_id: string;
  status: OrderExchangeStatus;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function isAction(value: unknown): value is OrderExchangeAction {
  return value === 'send' || value === 'accept' || value === 'request_change' || value === 'reject' || value === 'cancel';
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
    if (!isAction(body.action)) return jsonError('动作无效', 400);

    const supabase = getSupabaseClient();
    const { data: exchange, error: fetchError } = await supabase
      .from('order_exchanges')
      .select('id, order_id, from_tenant_id, to_tenant_id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !exchange) return jsonError('订单流转不存在', 404);
    const row = exchange as ExchangeRow;
    if (!isValidOrderExchangeStatus(row.status)) return jsonError('当前流转状态异常', 400);
    if (!canSeeExchange(user, row)) return jsonError('无权查看该订单流转', 403);
    if (!canActOnExchange(user, row, body.action)) return jsonError('无权处理该订单流转', 403);

    const nextStatus = nextExchangeStatus(row.status, body.action);
    if (!nextStatus) {
      return jsonError(`不允许从「${row.status}」执行「${body.action}」`, 400);
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const proposedChanges = body.proposed_changes && typeof body.proposed_changes === 'object' ? body.proposed_changes : null;
    const updateData: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (message) updateData.message = message;
    if (body.action === 'request_change' && proposedChanges) updateData.proposed_changes = proposedChanges;
    if (body.action === 'accept' || body.action === 'request_change' || body.action === 'reject') {
      updateData.handled_by = user.id;
      updateData.handled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('order_exchanges')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return jsonError(error.message, 500);

    if (body.action === 'accept') {
      await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          target_factory_id: row.to_tenant_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.order_id)
        .in('status', ['pending', 'returned']);
    }

    return NextResponse.json({ success: true, exchange: data });
  } catch (error) {
    console.error('update order exchange failed:', error);
    return jsonError('更新订单流转失败', 500);
  }
}
