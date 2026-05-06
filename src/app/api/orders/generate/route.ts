import { getSupabaseServiceClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const cookieStore = await cookies();
    const userSession = cookieStore.get('user_session');
    
    if (!userSession) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const user = JSON.parse(userSession.value);
    const tenantId = user.tenant_id;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: '用户无关联租户' }, { status: 400 });
    }

    // 获取租户的订单前缀
    const { data: prefixData, error: prefixError } = await supabase
      .from('order_prefixes')
      .select('prefix, current_val')
      .eq('tenant_id', tenantId)
      .single();

    if (prefixError || !prefixData) {
      return NextResponse.json({ success: false, error: '未找到订单前缀配置' }, { status: 404 });
    }

    const prefix = prefixData.prefix;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // 使用 order_prefixes 表的序号，如果序号小于当天订单数则以当天订单数为准
    let sequence = (prefixData.current_val || 0) + 1;
    
    // 查询当天该租户的订单数量，用于确保序号不重复
    const startDate = `${dateStr}000000`;
    const endDate = `${dateStr}235959`;

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('order_no')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (orderData && orderData.length > 0) {
      // 找到当天最大的序号
      const sequences = orderData.map(order => {
        const match = order.order_no.match(/^.*(\d{8})(\d{2})$/);
        return match ? parseInt(match[2], 10) : 0;
      });
      const maxSeq = Math.max(...sequences);
      // 确保序号不重复
      sequence = Math.max(sequence, maxSeq + 1);
    }

    // 生成订单号: 前缀 + 日期 + 顺序号（两位数）
    const orderNo = `${prefix}${dateStr}${sequence.toString().padStart(2, '0')}`;

    // 更新序号到 order_prefixes 表
    await supabase
      .from('order_prefixes')
      .update({ current_val: sequence })
      .eq('tenant_id', tenantId);

    return NextResponse.json({
      success: true,
      orderNo,
      prefix,
      date: dateStr,
      sequence,
      tenantId
    });
  } catch (error) {
    console.error('生成订单号失败:', error);
    return NextResponse.json(
      { success: false, error: '生成订单号失败' },
      { status: 500 }
    );
  }
}
