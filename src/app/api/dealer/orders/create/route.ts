import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const requestBodySchema = z.object({
  customerName: z.string().trim().min(1),
  customerPhone: z.string().trim().optional().default(''),
  deliveryDate: z.string().trim().optional(),
  targetFactoryId: z.string().uuid(),
  items: z.array(z.object({
    productName: z.string().trim().min(1),
    specification: z.string().trim().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
  remark: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.create');
    if (context.enterpriseType !== 'dealer') {
      return NextResponse.json({ success: false, error: '只有经销商企业可创建该类型订单' }, { status: 403 });
    }
    const input = await parseJson(request, requestBodySchema);
    const supabase = await createClient();
    const { data: order, error: orderError } = await supabase.rpc(
      'create_dealer_order_with_items',
      {
        target_enterprise_id: context.enterpriseId,
        target_factory_id: input.targetFactoryId,
        target_order: {
          customer_name: input.customerName,
          customer_phone: input.customerPhone || null,
          delivery_date: input.deliveryDate || null,
          remark: input.remark || null,
          items: input.items.map((item) => ({
            product_name: item.productName,
            specification: item.specification || null,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
        },
      },
    );
    if (orderError || !order) {
      console.error('dealer_order.create_failed', { code: orderError?.code });
      if (orderError?.message === 'DEALER_ORDER_FACTORY_INVALID') {
        return NextResponse.json({ success: false, error: '目标工厂不可用' }, { status: 422 });
      }
      return NextResponse.json({ success: false, error: '创建订单失败' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      order: {
        id: (order as { id: string }).id,
        orderNo: (order as { order_no: string }).order_no,
        status: (order as { status: string }).status,
      },
    });
  } catch (error) {
    console.error('dealer_order.create_failed', { error });
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
