import { NextResponse, type NextRequest } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.read');
    const supplierId = request.nextUrl.searchParams.get('supplierId')
      || request.nextUrl.searchParams.get('supplier_id');
    if (!supplierId) {
      return NextResponse.json({ success: false, error: '缺少供应商ID (supplierId)' }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id,name,supplier_code')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', supplierId)
      .maybeSingle();
    if (supplierError || !supplier) {
      return NextResponse.json({ success: false, error: '供应商不存在' }, { status: 404 });
    }
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id,order_no,customer_name,status,total_amount,delivery_date,remark,created_at')
      .eq('enterprise_id', context.enterpriseId)
      .eq('target_factory_id', supplierId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('supplier_orders.list_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '获取供应商订单失败' }, { status: 500 });
    }
    return NextResponse.json({ success: true, supplier, orders: orders || [] });
  } catch (error) {
    console.error('supplier_orders.list_failed', { error });
    return NextResponse.json({ success: false, error: '获取供应商订单失败' }, { status: 500 });
  }
}
