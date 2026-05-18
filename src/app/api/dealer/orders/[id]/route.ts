import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { mapInternalStatusToDealerStatus } from '@/lib/permission-utils';
import { canAccessPath, isSuperAdmin } from '@/lib/role-access';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/dealer')) return jsonError('无权查看经销商订单', 403);
    const { id } = await params;
    const supabase = getSupabaseClient();
    let query = supabase
      .from('orders')
      .select('id, order_no, customer_name, customer_phone, customer_address, status, delivery_date, remark, created_at, updated_at, tenant_id, dealer_id, from_tenant_id, to_tenant_id')
      .eq('id', id);
    if (!isSuperAdmin(user)) {
      if (!user.tenant_id) return jsonError('用户未关联租户', 400);
      query = query.or(`tenant_id.eq.${user.tenant_id},dealer_id.eq.${user.tenant_id},from_tenant_id.eq.${user.tenant_id},to_tenant_id.eq.${user.tenant_id}`);
    }
    const { data, error } = await query.maybeSingle();
    if (error) return jsonError(error.message, 500);
    if (!data) return jsonError('订单不存在', 404);
    const status = String(data.status || '');
    return Response.json({
      success: true,
      data: {
        id: data.id,
        order_no: data.order_no,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_address: data.customer_address,
        status: data.status,
        external_status: mapInternalStatusToDealerStatus(status),
        progress: mapInternalStatusToDealerStatus(status),
        expected_ship_date: data.delivery_date,
        shipping_status: status === 'shipped' ? '已发货' : status === 'ready_to_ship' ? '待发货' : '未发货',
        logistics: null,
        remark: data.remark,
        created_at: data.created_at,
        updated_at: data.updated_at,
        timeline: [
          '订单已提交',
          '工厂已接单',
          '已排产',
          '生产中',
          '质检中',
          '待发货',
          '已发货',
          '已完成',
        ],
      },
    });
  } catch (error) {
    console.error('get dealer order detail failed:', error);
    return jsonError('获取经销商订单详情失败', 500);
  }
}
