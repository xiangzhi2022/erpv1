import { getSupabaseClient } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || 'QYD';
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // 查询当天该前缀的订单数量
    const startDate = `${dateStr}000000`;
    const endDate = `${dateStr}235959`;

    const { data, error } = await supabase
      .from('orders')
      .select('order_no')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .like('order_no', `${prefix}${dateStr}%`)
      .order('order_no', { ascending: false })
      .limit(1);

    let sequence = 1;
    if (data && data.length > 0) {
      // 提取最后一个序号
      const lastNo = data[0].order_no;
      const match = lastNo.match(/^(\D*)(\d{8})(\d{2})$/);
      if (match && match[2] === dateStr) {
        sequence = parseInt(match[3], 10) + 1;
      }
    }

    const orderNo = `${prefix}${dateStr}${sequence.toString().padStart(2, '0')}`;

    return NextResponse.json({
      success: true,
      orderNo,
      prefix,
      date: dateStr,
      sequence
    });
  } catch (error) {
    console.error('获取订单序号失败:', error);
    return NextResponse.json(
      { success: false, error: '获取订单序号失败' },
      { status: 500 }
    );
  }
}
