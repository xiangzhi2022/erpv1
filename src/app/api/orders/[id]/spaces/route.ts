import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.update');

    const { id } = await params;
    const supabase = await createClient();
    const { data: order } = await supabase
      .from('orders')
      .select('id,order_no')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (!order) return jsonError('订单不存在', 404);

    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const spaceName = typeof body.space_name === 'string' ? body.space_name.trim() : '';
    if (!spaceName) return jsonError('空间名称不能为空', 400);

    const { count } = await supabase
      .from('order_spaces')
      .select('id', { count: 'exact', head: true })
      .eq('enterprise_id', context.enterpriseId)
      .eq('order_id', id);
    const nextIndex = (count || 0) + 1;
    const spaceNo = `${order.order_no}-S${String(nextIndex).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('order_spaces')
      .insert({
        enterprise_id: context.enterpriseId,
        order_id: id,
        space_no: spaceNo,
        space_name: spaceName,
        space_type: typeof body.space_type === 'string' ? body.space_type.trim() || null : null,
        sort_order: Number(body.sort_order || nextIndex),
        status: 'draft',
        remark: typeof body.remark === 'string' ? body.remark.trim() || null : null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return jsonError('新增空间失败', 500);
    await supabase.from('order_status_logs').insert({
      enterprise_id: context.enterpriseId,
      target_type: 'space',
      target_id: data.id,
      from_status: null,
      to_status: 'draft',
      changed_by: context.userId,
      remark: '新增空间',
    });
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create order space failed:', error);
    return jsonError('新增空间失败', 500);
  }
}
