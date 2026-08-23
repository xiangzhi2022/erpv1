import { NextResponse, type NextRequest } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { mapInternalStatusToDealerStatus } from '@/lib/permission-utils';
import { createClient } from '@/lib/supabase/server';

function positiveInteger(value: string | null, fallback: number, maximum?: number): number {
  const parsed = Number.parseInt(value || '', 10);
  const positive = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return maximum ? Math.min(maximum, positive) : positive;
}

export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.read');
    const page = positiveInteger(request.nextUrl.searchParams.get('page'), 1);
    const pageSize = positiveInteger(request.nextUrl.searchParams.get('pageSize'), 20, 100);
    const status = request.nextUrl.searchParams.get('status');
    const supabase = await createClient();
    let query = supabase
      .from('orders')
      .select('id,order_no,customer_name,status,delivery_date,remark,created_at,updated_at', { count: 'exact' })
      .eq('enterprise_id', context.enterpriseId)
      .order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error('dealer_orders.list_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '获取订单失败' }, { status: 500 });
    }
    const orders = (data || []).map((order) => ({
      id: order.id,
      order_no: order.order_no,
      customer_name: order.customer_name,
      status: order.status,
      external_status: mapInternalStatusToDealerStatus(order.status),
      progress: mapInternalStatusToDealerStatus(order.status),
      expected_ship_date: order.delivery_date,
      shipping_status: order.status === 'shipped' ? '已发货' : order.status === 'ready_to_ship' ? '待发货' : '未发货',
      logistics: null,
      remark: order.remark,
      created_at: order.created_at,
      updated_at: order.updated_at,
    }));
    const stats = {
      pending: orders.filter((order) => order.status === 'pending').length,
      confirmed: orders.filter((order) => order.status === 'confirmed').length,
      producing: orders.filter((order) => order.status === 'producing').length,
      shipped: orders.filter((order) => order.status === 'shipped').length,
      completed: orders.filter((order) => order.status === 'completed').length,
    };
    return NextResponse.json({
      success: true,
      orders,
      stats,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('dealer_orders.list_failed', { error });
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
