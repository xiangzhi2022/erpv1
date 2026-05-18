import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canEditOrderContent } from '@/lib/four-level-order';
import { canSeeOrder, loadOrderTree, writeStatusLog } from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

async function getSpaceAndOrder(spaceId: string) {
  const supabase = getSupabaseClient();
  const { data: space } = await supabase.from('order_spaces').select('*').eq('id', spaceId).maybeSingle();
  if (!space) return { supabase, space: null, tree: null };
  const tree = await loadOrderTree(supabase, String(space.order_id));
  return { supabase, space: space as Record<string, unknown>, tree };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canEditOrderContent(user)) return jsonError('无权编辑空间', 403);
    const { id } = await params;
    const { supabase, space, tree } = await getSpaceAndOrder(id);
    if (!space || !tree) return jsonError('空间不存在', 404);
    if (!canSeeOrder(user, tree)) return jsonError('无权操作该空间', 403);

    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    ['space_name', 'space_type', 'sort_order', 'status', 'remark'].forEach((key) => {
      if (body[key] !== undefined) updateData[key] = body[key];
    });
    const previousStatus = typeof space.status === 'string' ? space.status : null;
    const { data, error } = await supabase.from('order_spaces').update(updateData).eq('id', id).select().single();
    if (error) return jsonError(error.message, 500);
    if (typeof updateData.status === 'string' && updateData.status !== previousStatus) {
      await writeStatusLog(supabase, 'space', id, previousStatus, updateData.status, user.id, '更新空间状态');
    }
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update space failed:', error);
    return jsonError('更新空间失败', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canEditOrderContent(user)) return jsonError('无权删除空间', 403);
    const { id } = await params;
    const { supabase, space, tree } = await getSpaceAndOrder(id);
    if (!space || !tree) return jsonError('空间不存在', 404);
    if (!canSeeOrder(user, tree)) return jsonError('无权操作该空间', 403);
    const { error } = await supabase.from('order_spaces').delete().eq('id', id);
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true });
  } catch (error) {
    console.error('delete space failed:', error);
    return jsonError('删除空间失败', 500);
  }
}
