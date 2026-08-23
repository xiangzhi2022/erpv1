import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import type { Database } from '@/db/database.types';
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
    let duplicateQuery = supabase.from('orders').select('id')
      .eq('enterprise_id', context.enterpriseId)
      .eq('order_no', input.order_no);
    if (input.existing_order_id) duplicateQuery = duplicateQuery.neq('id', input.existing_order_id);
    const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
    if (duplicateError) {
      return NextResponse.json({ success: false, error: '检查订单号失败' }, { status: 500 });
    }
    if (duplicate) {
      return NextResponse.json({ success: false, error: '订单号已存在，请重新生成' }, { status: 409 });
    }

    const payload: Database['public']['Tables']['orders']['Insert'] = {
      enterprise_id: context.enterpriseId,
      order_no: input.order_no,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone || null,
      customer_address: input.customer_address || null,
      status: 'pending',
      total_amount: 0,
      delivery_date: input.delivery_date || null,
      remark: input.remark || null,
      dealer_id: input.order_flow === 'dealer_to_factory' ? context.enterpriseId : null,
      order_flow: input.order_flow,
      from_enterprise_id: context.enterpriseId,
      to_enterprise_id: null,
      target_factory_id: null,
      parent_order_id: input.parent_order_id || null,
      created_by: context.userId,
    };

    if (input.existing_order_id) {
      const { data, error } = await supabase
        .from('orders')
        .update(payload)
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', input.existing_order_id)
        .select()
        .maybeSingle();
      if (error) return NextResponse.json({ success: false, error: '保存订单失败' }, { status: 500 });
      if (!data) return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
      return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabase.from('orders').insert(payload).select().single();
    if (error || !data) {
      return NextResponse.json({ success: false, error: '保存订单失败' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('basic_order.save_failed', { error });
    return NextResponse.json({ success: false, error: '保存订单失败' }, { status: 500 });
  }
}
