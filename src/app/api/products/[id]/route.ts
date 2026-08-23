import { z } from 'zod';
import { ORDER_STATUS_VALUES } from '@/lib/four-level-order';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseParams } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });
const productUpdateSchema = z.object({
  product_name: z.string().trim().min(1).max(200).optional(),
  product_type: z.string().trim().min(1).max(100).optional(),
  product_model: z.string().trim().max(100).nullable().optional(),
  width: z.number().finite().nonnegative().nullable().optional(),
  height: z.number().finite().nonnegative().nullable().optional(),
  depth: z.number().finite().nonnegative().nullable().optional(),
  area: z.number().finite().nonnegative().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  material: z.string().trim().max(200).nullable().optional(),
  color: z.string().trim().max(100).nullable().optional(),
  status: z.enum(ORDER_STATUS_VALUES).optional(),
  sort_order: z.number().int().nonnegative().optional(),
  remark: z.string().trim().max(2000).nullable().optional(),
  quoted_amount: z.number().finite().nonnegative().optional(),
  cost_amount: z.number().finite().nonnegative().optional(),
  profit_amount: z.number().finite().optional(),
  internal_remark: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((input) => Object.keys(input).length > 0, '没有可更新的产品字段');

function errorResponse(error: unknown, fallback: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) {
    return Response.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('order_product.request_failed', { error });
  return Response.json({ success: false, error: fallback }, { status: 500 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.update');
    const { id } = await parseParams(params, paramsSchema);
    const input = await parseJson(request, productUpdateSchema);
    const financialUpdate = input.quoted_amount !== undefined
      || input.cost_amount !== undefined
      || input.profit_amount !== undefined
      || input.internal_remark !== undefined;
    if (financialUpdate) requirePermission(context, 'finance.manage');
    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase.from('order_products')
      .select('id,status')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (existingError) return Response.json({ success: false, error: '查询产品失败' }, { status: 500 });
    if (!existing) return Response.json({ success: false, error: '产品不存在' }, { status: 404 });
    const { data, error } = await supabase.from('order_products')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .select('id,order_id,space_id,product_no,product_name,product_type,product_model,width,height,depth,area,quantity,material,color,status,sort_order,remark,updated_at')
      .maybeSingle();
    if (error) return Response.json({ success: false, error: '更新产品失败' }, { status: 500 });
    if (!data) return Response.json({ success: false, error: '产品不存在' }, { status: 404 });
    if (input.status && input.status !== existing.status) {
      const { error: logError } = await supabase.from('order_status_logs').insert({
        enterprise_id: context.enterpriseId,
        target_type: 'product',
        target_id: id,
        from_status: existing.status,
        to_status: input.status,
        changed_by: context.userId,
        remark: '更新产品状态',
      });
      if (logError) console.error('order_product.status_log_failed', { code: logError.code });
    }
    return Response.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, '更新产品失败');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.update');
    const { id } = await parseParams(params, paramsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.from('order_products')
      .delete()
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) return Response.json({ success: false, error: '删除产品失败' }, { status: 500 });
    if (!data) return Response.json({ success: false, error: '产品不存在' }, { status: 404 });
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error, '删除产品失败');
  }
}
