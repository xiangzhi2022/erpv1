import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.update');

    const { id: spaceId } = await params;
    const supabase = await createClient();
    const { data: space } = await supabase.from('order_spaces').select('id,order_id')
      .eq('enterprise_id', context.enterpriseId).eq('id', spaceId).maybeSingle();
    if (!space) return jsonError('空间不存在', 404);

    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const productName = optionalText(body.product_name);
    if (!productName) return jsonError('产品名称不能为空', 400);

    const financeAllowed = hasEnterprisePermission(context, 'finance.manage');
    const productInput: Record<string, unknown> = {
      space_id: spaceId,
      product_name: productName,
      product_type: optionalText(body.product_type) || 'custom',
      product_model: optionalText(body.product_model),
      width: optionalNumber(body.width),
      height: optionalNumber(body.height),
      depth: optionalNumber(body.depth),
      area: optionalNumber(body.area),
      quantity: optionalNumber(body.quantity) ?? 1,
      material: optionalText(body.material),
      color: optionalText(body.color),
      sort_order: optionalNumber(body.sort_order) ?? 1,
      remark: optionalText(body.remark),
    };
    const financialInputPresent = ['quoted_amount', 'cost_amount', 'profit_amount', 'internal_remark']
      .some((field) => Object.hasOwn(body, field));
    if (financialInputPresent && !financeAllowed) return jsonError('无权设置产品财务字段', 403);
    if (financialInputPresent) {
      Object.assign(productInput, {
        quoted_amount: optionalNumber(body.quoted_amount) ?? 0,
        cost_amount: optionalNumber(body.cost_amount) ?? 0,
        profit_amount: optionalNumber(body.profit_amount) ?? 0,
        internal_remark: optionalText(body.internal_remark),
      });
    }
    const { data, error } = await supabase.rpc('create_order_product_with_pricing' as never, {
      target_enterprise_id: context.enterpriseId,
      target_order_id: String(space.order_id),
      target_product: productInput,
    } as never);
    if (error) return jsonError('新增产品失败', error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : 500);
    const createdProduct = Array.isArray(data) ? data[0] : data;
    if (!createdProduct) return jsonError('新增产品失败', 500);
    const safeProduct = { ...(createdProduct as Record<string, unknown>) };
    for (const field of ['quoted_amount', 'cost_amount', 'profit_amount', 'internal_remark']) {
      Reflect.deleteProperty(safeProduct, field);
    }
    return Response.json({ success: true, data: safeProduct });
  } catch (error) {
    console.error('create product failed:', error);
    return jsonError('新增产品失败', 500);
  }
}
