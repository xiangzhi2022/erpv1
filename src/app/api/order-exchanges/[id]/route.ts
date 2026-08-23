import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import {
  isValidOrderExchangeStatus,
  nextExchangeStatus,
  type OrderExchangeAction,
} from '@/lib/order-exchange';
import { createClient } from '@/lib/supabase/server';

const actionSchema = z.object({
  action: z.enum(['send', 'accept', 'request_change', 'reject', 'withdraw']),
  message: z.string().trim().max(2000).optional(),
  proposed_changes: z.json().nullable().optional(),
});

function permissionForAction(action: OrderExchangeAction) {
  return action === 'withdraw' || action === 'send' ? 'orders.update' as const : 'orders.accept' as const;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    const input = await parseJson(request, actionSchema);
    requirePermission(context, permissionForAction(input.action));
    const { id } = await params;
    const supabase = await createClient();
    const { data: exchange, error: fetchError } = await supabase
      .from('order_exchanges')
      .select('id,order_id,from_enterprise_id,to_enterprise_id,status,message')
      .eq('id', id)
      .or(
        `from_enterprise_id.eq.${context.enterpriseId},to_enterprise_id.eq.${context.enterpriseId}`,
      )
      .maybeSingle();
    if (fetchError || !exchange) {
      return NextResponse.json({ success: false, error: '订单流转不存在' }, { status: 404 });
    }
    if (!isValidOrderExchangeStatus(exchange.status)) {
      return NextResponse.json({ success: false, error: '当前流转状态异常' }, { status: 409 });
    }
    const isSender = exchange.from_enterprise_id === context.enterpriseId;
    const isReceiver = exchange.to_enterprise_id === context.enterpriseId;
    if ((input.action === 'withdraw' || input.action === 'send') ? !isSender : !isReceiver) {
      return NextResponse.json({ success: false, error: '无权处理该订单流转' }, { status: 403 });
    }
    const nextStatus = nextExchangeStatus(exchange.status, input.action);
    if (!nextStatus) {
      return NextResponse.json({ success: false, error: '当前状态不允许执行该动作' }, { status: 409 });
    }
    const message = input.message
      ? input.action === 'withdraw' && exchange.message
        ? `${exchange.message}\n撤回原因：${input.message}`
        : input.action === 'withdraw'
          ? `撤回原因：${input.message}`
          : input.message
      : exchange.message;
    const { data, error } = await supabase
      .from('order_exchanges')
      .update({
        status: nextStatus,
        message,
        proposed_changes: input.action === 'request_change'
          ? input.proposed_changes ?? null
          : undefined,
        handled_by: context.userId,
        handled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', exchange.status)
      .select()
      .maybeSingle();
    if (error) {
      console.error('order_exchange.update_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '更新订单流转失败' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ success: false, error: '订单流转状态已变化' }, { status: 409 });
    }
    return NextResponse.json({ success: true, exchange: data });
  } catch (error) {
    console.error('order_exchange.update_failed', { error });
    return NextResponse.json({ success: false, error: '更新订单流转失败' }, { status: 500 });
  }
}
