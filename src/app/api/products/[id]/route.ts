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
    const {
      quoted_amount: quotedAmount,
      cost_amount: costAmount,
      profit_amount: profitAmount,
      internal_remark: internalRemark,
      status: requestedStatus,
      ...directInput
    } = input;
    const updateCategoryCount = [
      financialUpdate,
      Object.keys(directInput).length > 0,
      requestedStatus !== undefined,
    ].filter(Boolean).length;
    if (updateCategoryCount > 1) {
      return Response.json(
        { success: false, error: '财务、状态和基础字段请分别提交' },
        { status: 422 },
      );
    }
    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase.from('order_products')
      .select('id,status')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (existingError) return Response.json({ success: false, error: '查询产品失败' }, { status: 500 });
    if (!existing) return Response.json({ success: false, error: '产品不存在' }, { status: 404 });
    if (financialUpdate) {
      const { error } = await supabase.rpc('finance_update_order_product' as never, {
        target_enterprise_id: context.enterpriseId,
        target_product_id: id,
        target_quoted_amount: quotedAmount ?? null,
        target_cost_amount: costAmount ?? null,
        target_profit_amount: profitAmount ?? null,
        target_internal_remark: internalRemark ?? null,
        update_internal_remark: input.internal_remark !== undefined,
      } as never);
      if (error) {
        return Response.json(
          { success: false, error: '更新产品财务字段失败' },
          { status: error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 500 },
        );
      }
    }
    if (Object.keys(directInput).length > 0) {
      const { error } = await supabase.rpc('update_order_component_fields' as never, {
        target_enterprise_id: context.enterpriseId,
        target_type: 'product',
        target_id: id,
        target_fields: directInput,
      } as never);
      if (error) return Response.json({ success: false, error: '更新产品失败' }, { status: error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : 500 });
    }
    if (requestedStatus && requestedStatus !== existing.status) {
      const { error } = await supabase.rpc('transition_order_component_status' as never, {
        target_enterprise_id: context.enterpriseId,
        target_type: 'product',
        target_id: id,
        target_expected_status: existing.status,
        target_status: requestedStatus,
        target_remark: '更新产品状态',
      } as never);
      if (error) {
        return Response.json(
          { success: false, error: error.code === 'P0001' ? '产品状态已变化' : '更新产品状态失败' },
          { status: error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : 500 },
        );
      }
    }
    const { data, error } = await supabase.from('order_products')
      .select('id,order_id,space_id,product_no,product_name,product_type,product_model,width,height,depth,area,quantity,material,color,status,sort_order,remark,updated_at')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (error) return Response.json({ success: false, error: '查询产品失败' }, { status: 500 });
    if (!data) return Response.json({ success: false, error: '产品不存在' }, { status: 404 });
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
    const { error } = await supabase.rpc('delete_order_component' as never, {
      target_enterprise_id: context.enterpriseId,
      target_type: 'product',
      target_id: id,
    } as never);
    if (error) {
      return Response.json(
        {
          success: false,
          error: error.code === 'P0001'
            ? '当前订单状态或关联生产数据不允许删除产品'
            : '删除产品失败',
        },
        {
          status: error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : 500,
        },
      );
    }
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error, '删除产品失败');
  }
}
