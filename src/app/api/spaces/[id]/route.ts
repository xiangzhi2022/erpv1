import { parseJsonObject } from '@/lib/api/request';
import type { Database } from '@/db/database.types';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

async function getSpace(spaceId: string, enterpriseId: string) {
  const supabase = await createClient();
  const { data: space } = await supabase
    .from('order_spaces')
    .select('*')
    .eq('enterprise_id', enterpriseId)
    .eq('id', spaceId)
    .maybeSingle();
  return { supabase, space };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.update');
    const { id } = await params;
    const { supabase, space } = await getSpace(id, context.enterpriseId);
    if (!space) return jsonError('空间不存在', 404);

    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const updateData: Database['public']['Tables']['order_spaces']['Update'] = {};
    if (typeof body.space_name === 'string') updateData.space_name = body.space_name.trim();
    if (typeof body.space_type === 'string' || body.space_type === null) updateData.space_type = body.space_type;
    if (typeof body.sort_order === 'number') updateData.sort_order = body.sort_order;
    const requestedStatus = typeof body.status === 'string' ? body.status : null;
    if (typeof body.remark === 'string' || body.remark === null) updateData.remark = body.remark;
    const previousStatus = typeof space.status === 'string' ? space.status : null;
    if (requestedStatus && requestedStatus !== previousStatus && Object.keys(updateData).length > 0) {
      return jsonError('基础字段和状态请分别提交', 422);
    }
    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.rpc('update_order_component_fields' as never, {
        target_enterprise_id: context.enterpriseId,
        target_type: 'space',
        target_id: id,
        target_fields: updateData,
      } as never);
      if (error) return jsonError('更新空间失败', error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : 500);
    }
    if (requestedStatus && requestedStatus !== previousStatus) {
      const { error } = await supabase.rpc('transition_order_component_status' as never, {
        target_enterprise_id: context.enterpriseId,
        target_type: 'space',
        target_id: id,
        target_expected_status: previousStatus,
        target_status: requestedStatus,
        target_remark: '更新空间状态',
      } as never);
      if (error) {
        return jsonError(
          error.code === 'P0001' ? '空间状态已变化' : '更新空间状态失败',
          error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : 500,
        );
      }
    }
    const { data, error } = await supabase.from('order_spaces').select('*')
      .eq('enterprise_id', context.enterpriseId).eq('id', id).maybeSingle();
    if (error) return jsonError('查询空间失败', 500);
    if (!data) return jsonError('空间不存在', 404);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update space failed:', error);
    return jsonError('更新空间失败', 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.update');
    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase.rpc('delete_order_component' as never, {
      target_enterprise_id: context.enterpriseId,
      target_type: 'space',
      target_id: id,
    } as never);
    if (error) {
      return jsonError(
        error.code === 'P0001' ? '当前订单状态或关联生产数据不允许删除空间' : '删除空间失败',
        error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : 500,
      );
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error('delete space failed:', error);
    return jsonError('删除空间失败', 500);
  }
}
