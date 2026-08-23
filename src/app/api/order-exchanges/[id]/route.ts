import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import {
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
    const { data, error } = await supabase.rpc('transition_order_exchange', {
      target_exchange_id: id,
      target_action: input.action,
      target_message: input.message ?? null,
      target_proposed_changes: input.proposed_changes ?? null,
    });
    if (error) {
      console.error('order_exchange.update_failed', { code: error.code });
      if (error.code === 'P0002') {
        return NextResponse.json({ success: false, error: '订单流转不存在' }, { status: 404 });
      }
      if (error.code === '42501') {
        return NextResponse.json({ success: false, error: '无权处理该订单流转' }, { status: 403 });
      }
      if (error.code === 'P0001') {
        return NextResponse.json({ success: false, error: '当前状态不允许执行该动作' }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: '更新订单流转失败' }, { status: 500 });
    }
    const exchange = data?.[0];
    if (!exchange) {
      return NextResponse.json({ success: false, error: '订单流转状态已变化' }, { status: 409 });
    }
    return NextResponse.json({ success: true, exchange });
  } catch (error) {
    console.error('order_exchange.update_failed', { error });
    return NextResponse.json({ success: false, error: '更新订单流转失败' }, { status: 500 });
  }
}
