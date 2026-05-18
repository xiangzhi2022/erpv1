import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canEditFinancialFields, canEditOrderContent } from '@/lib/four-level-order';
import { canSeeOrder, loadOrderTree, writeStatusLog } from '@/lib/four-level-order-server';

const BASIC_FIELDS = ['product_name', 'product_type', 'product_model', 'width', 'height', 'depth', 'area', 'quantity', 'material', 'color', 'status', 'sort_order', 'remark'];
const FINANCE_FIELDS = ['quoted_amount', 'cost_amount', 'profit_amount', 'internal_remark'];

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

async function getProductContext(productId: string) {
  const supabase = getSupabaseClient();
  const { data: product } = await supabase.from('order_products').select('*').eq('id', productId).maybeSingle();
  if (!product) return { supabase, product: null, tree: null };
  const tree = await loadOrderTree(supabase, String(product.order_id));
  return { supabase, product: product as Record<string, unknown>, tree };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    const { id } = await params;
    const { supabase, product, tree } = await getProductContext(id);
    if (!product || !tree) return jsonError('产品不存在', 404);
    if (!canSeeOrder(user, tree)) return jsonError('无权操作该产品', 403);

    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (canEditOrderContent(user)) {
      BASIC_FIELDS.forEach((key) => {
        if (body[key] !== undefined) updateData[key] = body[key];
      });
    }
    if (canEditFinancialFields(user)) {
      FINANCE_FIELDS.forEach((key) => {
        if (body[key] !== undefined) updateData[key] = body[key];
      });
    }
    const previousStatus = typeof product.status === 'string' ? product.status : null;
    const { data, error } = await supabase.from('order_products').update(updateData).eq('id', id).select().single();
    if (error) return jsonError(error.message, 500);
    if (typeof updateData.status === 'string' && updateData.status !== previousStatus) {
      await writeStatusLog(supabase, 'product', id, previousStatus, updateData.status, user.id, '更新产品状态');
    }
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update product failed:', error);
    return jsonError('更新产品失败', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canEditOrderContent(user)) return jsonError('无权删除产品', 403);
    const { id } = await params;
    const { supabase, product, tree } = await getProductContext(id);
    if (!product || !tree) return jsonError('产品不存在', 404);
    if (!canSeeOrder(user, tree)) return jsonError('无权操作该产品', 403);
    const { error } = await supabase.from('order_products').delete().eq('id', id);
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true });
  } catch (error) {
    console.error('delete product failed:', error);
    return jsonError('删除产品失败', 500);
  }
}
