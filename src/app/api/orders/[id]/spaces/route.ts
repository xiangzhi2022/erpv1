import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canEditOrderContent } from '@/lib/four-level-order';
import { canSeeOrder, loadOrderTree, writeStatusLog } from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canEditOrderContent(user)) return jsonError('无权新增空间', 403);

    const { id } = await params;
    const supabase = getSupabaseClient();
    const tree = await loadOrderTree(supabase, id);
    if (!tree) return jsonError('订单不存在', 404);
    if (!canSeeOrder(user, tree)) return jsonError('无权操作该订单', 403);

    const body = (await request.json()) as Record<string, unknown>;
    const spaceName = typeof body.space_name === 'string' ? body.space_name.trim() : '';
    if (!spaceName) return jsonError('空间名称不能为空', 400);

    const { count } = await supabase
      .from('order_spaces')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', id);
    const nextIndex = (count || 0) + 1;
    const spaceNo = `${String(tree.order_no || 'ORDER')}-S${String(nextIndex).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('order_spaces')
      .insert({
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

    if (error) return jsonError(error.message, 500);
    await writeStatusLog(supabase, 'space', String(data.id), null, 'draft', user.id, '新增空间');
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create order space failed:', error);
    return jsonError('新增空间失败', 500);
  }
}
