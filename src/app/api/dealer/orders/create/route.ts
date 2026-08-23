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
    const { data: targetFactory } = await supabase
      .from('enterprises')
      .select('id')
      .eq('id', input.targetFactoryId)
      .eq('enterprise_type', 'manufacturer')
      .eq('status', 'active')
      .maybeSingle();
    if (!targetFactory) {
      return NextResponse.json({ success: false, error: '目标工厂不可用' }, { status: 422 });
    }

    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('order_no')
      .eq('enterprise_id', context.enterpriseId)
      .like('order_no', `ORD${dateStr}%`)
      .order('order_no', { ascending: false })
      .limit(1);
    const lastSequence = existingOrders?.[0]?.order_no.match(/(\d{4})$/)?.[1];
    const sequence = lastSequence ? Number.parseInt(lastSequence, 10) + 1 : 1;
    const orderNo = `ORD${dateStr}${String(sequence).padStart(4, '0')}`;
    const totalAmount = input.items.reduce(
      (total, item) => total + item.quantity * item.unitPrice,
      0,
    );
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        enterprise_id: context.enterpriseId,
        order_no: orderNo,
        customer_name: input.customerName,
        customer_phone: input.customerPhone || null,
        status: 'pending',
        total_amount: totalAmount,
        target_factory_id: targetFactory.id,
        dealer_id: context.enterpriseId,
        order_flow: 'dealer_to_factory',
        from_enterprise_id: context.enterpriseId,
        to_enterprise_id: targetFactory.id,
        delivery_date: input.deliveryDate || null,
        remark: input.remark || null,
        created_by: context.userId,
      })
      .select('id,order_no,status')
      .single();
    if (orderError || !order) {
      console.error('dealer_order.create_failed', { code: orderError?.code });
      return NextResponse.json({ success: false, error: '创建订单失败' }, { status: 500 });
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      input.items.map((item) => ({
        enterprise_id: context.enterpriseId,
        order_id: order.id,
        product_name: item.productName,
        specifications: item.specification || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        unit: '件',
      })),
    );
    if (itemsError) {
      await supabase.from('orders').delete()
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', order.id);
      console.error('dealer_order.items_create_failed', { code: itemsError.code });
      return NextResponse.json({ success: false, error: '创建订单明细失败' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      order: { id: order.id, orderNo: order.order_no, status: order.status },
    });
  } catch (error) {
    console.error('dealer_order.create_failed', { error });
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
