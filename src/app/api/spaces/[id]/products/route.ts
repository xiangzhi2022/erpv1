import { parseJsonObject } from '@/lib/api/request';
import type { Database } from '@/db/database.types';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
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
    const { data: space } = await supabase.from('order_spaces').select('*')
      .eq('enterprise_id', context.enterpriseId).eq('id', spaceId).maybeSingle();
    if (!space) return jsonError('空间不存在', 404);

    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const productName = optionalText(body.product_name);
    if (!productName) return jsonError('产品名称不能为空', 400);

    const { count } = await supabase
      .from('order_products')
      .select('id', { count: 'exact', head: true })
      .eq('enterprise_id', context.enterpriseId)
      .eq('space_id', spaceId);
    const nextIndex = (count || 0) + 1;
    const productNo = `${space.space_no}-P${String(nextIndex).padStart(2, '0')}`;
    const financeAllowed = context.grants.has('finance.manage');

    const insertData: Database['public']['Tables']['order_products']['Insert'] = {
      enterprise_id: context.enterpriseId,
      order_id: String(space.order_id),
      space_id: spaceId,
      product_no: productNo,
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
      status: 'draft',
      sort_order: Number(body.sort_order || nextIndex),
      remark: optionalText(body.remark),
      updated_at: new Date().toISOString(),
    };
    if (financeAllowed) {
      insertData.quoted_amount = optionalNumber(body.quoted_amount) ?? 0;
      insertData.cost_amount = optionalNumber(body.cost_amount) ?? 0;
      insertData.profit_amount = optionalNumber(body.profit_amount) ?? 0;
      insertData.internal_remark = optionalText(body.internal_remark);
    }

    const { data, error } = await supabase.from('order_products').insert(insertData).select().single();
    if (error) return jsonError('新增产品失败', 500);
    await supabase.from('order_status_logs').insert({
      enterprise_id: context.enterpriseId,
      target_type: 'product',
      target_id: data.id,
      from_status: null,
      to_status: 'draft',
      changed_by: context.userId,
      remark: '新增产品',
    });
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create product failed:', error);
    return jsonError('新增产品失败', 500);
  }
}
