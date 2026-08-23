import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const basicOrderSchema = z.object({
  existing_order_id: z.string().uuid().optional(),
  order_no: z.string().trim().min(1),
  order_flow: z.enum(['dealer_to_factory', 'factory_to_supplier']).default('dealer_to_factory'),
  parent_order_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().trim().min(1),
  customer_phone: z.string().trim().nullable().optional(),
  customer_address: z.string().trim().nullable().optional(),
  delivery_date: z.string().trim().nullable().optional(),
  remark: z.string().trim().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    const input = await parseJson(request, basicOrderSchema);
    requirePermission(context, input.existing_order_id ? 'orders.update' : 'orders.create');
    const flowAllowed = input.order_flow === 'dealer_to_factory'
      ? context.enterpriseType === 'dealer'
      : context.enterpriseType === 'manufacturer';
    if (!flowAllowed) {
      return NextResponse.json({ success: false, error: '无权限创建该类型订单' }, { status: 403 });
    }
    const supabase = await createClient();
    const basicOrderPayload = {
      order_no: input.order_no,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone || null,
      customer_address: input.customer_address || null,
      delivery_date: input.delivery_date || null,
      remark: input.remark || null,
      order_flow: input.order_flow,
      parent_order_id: input.parent_order_id || null,
    };

    if (input.existing_order_id) {
      const basicOrderUpdatePayload = basicOrderPayload;
      const { data, error } = await supabase.rpc('update_basic_order', {
        target_enterprise_id: context.enterpriseId,
        target_order_id: input.existing_order_id,
        target_order: basicOrderUpdatePayload,
      });
      if (error) {
        const status = error.code === 'P0002'
          ? 404
          : error.code === 'P0001' || error.code === '23505'
            ? 409
            : error.code === '42501'
              ? 403
              : error.code === '22023'
                ? 422
                : 500;
        const message = error.code === 'P0002'
          ? '订单不存在'
          : error.code === 'P0001'
            ? '订单状态已变化'
            : error.code === '23505'
              ? '订单号已存在，请重新生成'
              : '保存订单失败';
        return NextResponse.json({ success: false, error: message }, { status });
      }
      if (!data) return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabase.rpc('create_basic_order', {
      target_enterprise_id: context.enterpriseId,
      target_order: basicOrderPayload,
    });
    if (error || !data) {
      const status = error?.code === '23505'
        ? 409
        : error?.code === '42501'
          ? 403
          : error?.code === 'P0002'
            ? 404
            : error?.code === '22023'
              ? 422
              : 500;
      const message = error?.code === '23505'
        ? '订单号已存在，请重新生成'
        : error?.code === 'P0002'
          ? '关联订单不存在'
          : '保存订单失败';
      return NextResponse.json({ success: false, error: message }, { status });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('basic_order.save_failed', { error });
    return NextResponse.json({ success: false, error: '保存订单失败' }, { status: 500 });
  }
}
