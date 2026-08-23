import { NextResponse, type NextRequest } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { mapInternalStatusToDealerStatus } from '@/lib/permission-utils';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.read');
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('orders')
      .select('id,order_no,customer_name,customer_phone,customer_address,status,delivery_date,remark,created_at,updated_at')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('dealer_order.get_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '获取订单详情失败' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    const externalStatus = mapInternalStatusToDealerStatus(data.status);
    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        order_no: data.order_no,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address,
        status: data.status,
        external_status: externalStatus,
        progress: externalStatus,
        expected_ship_date: data.delivery_date,
        shipping_status: data.status === 'shipped' ? '已发货' : data.status === 'ready_to_ship' ? '待发货' : '未发货',
        logistics: null,
        remark: data.remark,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    });
  } catch (error) {
    console.error('dealer_order.get_failed', { error });
    return NextResponse.json({ success: false, error: '获取订单详情失败' }, { status: 500 });
  }
}
