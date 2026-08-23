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
    const updateData: Database['public']['Tables']['order_spaces']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.space_name === 'string') updateData.space_name = body.space_name.trim();
    if (typeof body.space_type === 'string' || body.space_type === null) updateData.space_type = body.space_type;
    if (typeof body.sort_order === 'number') updateData.sort_order = body.sort_order;
    if (typeof body.status === 'string') updateData.status = body.status;
    if (typeof body.remark === 'string' || body.remark === null) updateData.remark = body.remark;
    const previousStatus = typeof space.status === 'string' ? space.status : null;
    const { data, error } = await supabase.from('order_spaces').update(updateData)
      .eq('enterprise_id', context.enterpriseId).eq('id', id).select().single();
    if (error) return jsonError('更新空间失败', 500);
    if (typeof updateData.status === 'string' && updateData.status !== previousStatus) {
      await supabase.from('order_status_logs').insert({
        enterprise_id: context.enterpriseId,
        target_type: 'space',
        target_id: id,
        from_status: previousStatus,
        to_status: updateData.status,
        changed_by: context.userId,
        remark: '更新空间状态',
      });
    }
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update space failed:', error);
    return jsonError('更新空间失败', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.update');
    const { id } = await params;
    const { supabase, space } = await getSpace(id, context.enterpriseId);
    if (!space) return jsonError('空间不存在', 404);
    const { error } = await supabase.from('order_spaces').delete()
      .eq('enterprise_id', context.enterpriseId).eq('id', id);
    if (error) return jsonError('删除空间失败', 500);
    return Response.json({ success: true });
  } catch (error) {
    console.error('delete space failed:', error);
    return jsonError('删除空间失败', 500);
  }
}
