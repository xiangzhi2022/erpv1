import { NextResponse } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'catalog.read');
    const supabase = await createClient();
    const { data } = await supabase
      .from('order_prefixes')
      .select('prefix')
      .eq('enterprise_id', context.enterpriseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const prefix = data?.prefix || 'ORD';
    return NextResponse.json({ success: true, data: { prefix }, prefix });
  } catch (error) {
    console.error('order_prefix.get_failed', { error });
    return NextResponse.json({ success: false, error: '获取订单前缀失败' }, { status: 500 });
  }
}
