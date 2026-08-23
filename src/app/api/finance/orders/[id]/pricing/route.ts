import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseParams } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });
// Order monetary values are persisted as integer cents. Keeping this boundary
// integer-only prevents a finance client from silently mixing yuan and cents.
const centsSchema = z.number().int().nonnegative();
const updatePricingSchema = z.object({
  total_amount: centsSchema.optional(),
  cost_amount: centsSchema.optional(),
  profit_amount: z.number().int().optional(),
  deposit_amount: centsSchema.optional(),
}).refine((input) => Object.keys(input).length > 0, '没有需要更新的字段');

interface RouteContext { params: Promise<{ id: string }>; }

function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('finance_order_pricing.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'finance.manage');
    const { id } = await parseParams(params, paramsSchema);
    const input = await parseJson(request, updatePricingSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('finance_update_order_pricing', {
      target_enterprise_id: context.enterpriseId,
      target_order_id: id,
      target_total_amount: input.total_amount ?? null,
      target_cost_amount: input.cost_amount ?? null,
      target_profit_amount: input.profit_amount ?? null,
      target_deposit_amount: input.deposit_amount ?? null,
    });
    if (error) throw error;
    const order = data?.[0];
    if (!order) return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return errorResponse(error, '更新财务价格失败');
  }
}
