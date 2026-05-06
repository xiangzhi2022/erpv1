import { getSupabaseServiceClient } from '@/storage/database/supabase-client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceClient();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');

    if (!tenantId) {
      return NextResponse.json({ success: false, error: '缺少租户ID' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('order_prefixes')
      .select('prefix, current_val')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: '未找到订单前缀配置' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      prefix: data.prefix,
      currentVal: data.current_val
    });
  } catch (error) {
    console.error('获取订单前缀失败:', error);
    return NextResponse.json(
      { success: false, error: '获取订单前缀失败' },
      { status: 500 }
    );
  }
}
