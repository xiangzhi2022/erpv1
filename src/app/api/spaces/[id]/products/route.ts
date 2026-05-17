import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canEditFinancialFields, canEditOrderContent } from '@/lib/four-level-order';
import { canSeeOrder, loadOrderTree, writeStatusLog } from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canEditOrderContent(user)) return jsonError('无权新增产品', 403);

    const { id: spaceId } = await params;
    const supabase = getSupabaseClient();
    const { data: space } = await supabase.from('order_spaces').select('*').eq('id', spaceId).maybeSingle();
    if (!space) return jsonError('空间不存在', 404);
    const tree = await loadOrderTree(supabase, String(space.order_id));
    if (!tree) return jsonError('订单不存在', 404);
    if (!canSeeOrder(user, tree)) return jsonError('无权操作该订单', 403);

    const body = (await request.json()) as Record<string, unknown>;
    const productName = optionalText(body.product_name);
    if (!productName) return jsonError('产品名称不能为空', 400);

    const { count } = await supabase
      .from('order_products')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', spaceId);
    const nextIndex = (count || 0) + 1;
    const productNo = `${String(space.space_no || tree.order_no)}-P${String(nextIndex).padStart(2, '0')}`;
    const financeAllowed = canEditFinancialFields(user);

    const insertData: Record<string, unknown> = {
      order_id: String(space.order_id),
      space_id: spaceId,
      product_no: productNo,
      product_name: productName,
      product_type: optionalText(body.product_type) || 'custom',
      product_model: optionalText(body.product_model),
      width: body.width ?? null,
      height: body.height ?? null,
      depth: body.depth ?? null,
      area: body.area ?? null,
      quantity: body.quantity ?? 1,
      material: optionalText(body.material),
      color: optionalText(body.color),
      status: 'draft',
      sort_order: Number(body.sort_order || nextIndex),
      remark: optionalText(body.remark),
      updated_at: new Date().toISOString(),
    };
    if (financeAllowed) {
      insertData.quoted_amount = body.quoted_amount ?? 0;
      insertData.cost_amount = body.cost_amount ?? 0;
      insertData.profit_amount = body.profit_amount ?? 0;
      insertData.internal_remark = optionalText(body.internal_remark);
    }

    const { data, error } = await supabase.from('order_products').insert(insertData).select().single();
    if (error) return jsonError(error.message, 500);
    await writeStatusLog(supabase, 'product', String(data.id), null, 'draft', user.id, '新增产品');
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create product failed:', error);
    return jsonError('新增产品失败', 500);
  }
}
