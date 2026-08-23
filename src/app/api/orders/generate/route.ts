import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const generateSchema = z.object({ prefix: z.string().trim().min(1).max(16).default('ORD') });

export async function POST(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.create');
    const { prefix } = await parseJson(request, generateSchema);
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('orders')
      .select('order_no')
      .eq('enterprise_id', context.enterpriseId)
      .like('order_no', `${prefix}${dateStr}%`)
      .order('order_no', { ascending: false })
      .limit(1);
    if (error) {
      console.error('order_number.generate_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '生成订单号失败' }, { status: 500 });
    }
    let sequence = 1;
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = data?.[0]?.order_no.match(new RegExp(`^${escapedPrefix}${dateStr}(\\d+)$`));
    if (match) sequence = Number.parseInt(match[1], 10) + 1;
    const orderNo = `${prefix}${dateStr}${String(sequence).padStart(3, '0')}`;
    return NextResponse.json({ success: true, data: { order_no: orderNo }, orderNo });
  } catch (error) {
    console.error('order_number.generate_failed', { error });
    return NextResponse.json({ success: false, error: '生成订单号失败' }, { status: 500 });
  }
}
