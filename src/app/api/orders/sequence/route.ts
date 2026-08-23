import { NextResponse, type NextRequest } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.create');
    const prefix = request.nextUrl.searchParams.get('prefix')?.trim() || 'ORD';
    const date = request.nextUrl.searchParams.get('date')?.trim()
      || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('orders')
      .select('order_no')
      .eq('enterprise_id', context.enterpriseId)
      .like('order_no', `${prefix}${date}%`)
      .order('order_no', { ascending: false })
      .limit(1);
    if (error) {
      console.error('order_sequence.get_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '获取订单序号失败' }, { status: 500 });
    }
    let sequence = 1;
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = data?.[0]?.order_no.match(new RegExp(`^${escapedPrefix}${date}(\\d+)$`));
    if (match) sequence = Number.parseInt(match[1], 10) + 1;
    const orderNo = `${prefix}${date}${String(sequence).padStart(3, '0')}`;
    return NextResponse.json({
      success: true,
      data: { order_no: orderNo, prefix, date, sequence },
      orderNo,
      prefix,
      date,
      sequence,
    });
  } catch (error) {
    console.error('order_sequence.get_failed', { error });
    return NextResponse.json({ success: false, error: '获取订单序号失败' }, { status: 500 });
  }
}
