import { z } from 'zod';
import { calculateTaskWage, PRODUCTION_TASK_TYPES } from '@/lib/four-level-order';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseParams } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });
const optionalNumber = z.coerce.number().finite().nonnegative().nullable().optional();
const createTaskSchema = z.object({
  task_name: z.string().trim().min(1).max(200),
  task_type: z.enum(PRODUCTION_TASK_TYPES).default('process'),
  task_code: z.string().trim().max(100).nullable().optional(),
  quantity: z.coerce.number().positive().default(1),
  unit: z.string().trim().min(1).max(32).default('件'),
  length: optionalNumber,
  width: optionalNumber,
  thickness: optionalNumber,
  area: optionalNumber,
  material: z.string().trim().max(200).nullable().optional(),
  color: z.string().trim().max(100).nullable().optional(),
  process_name: z.string().trim().max(200).nullable().optional(),
  workshop_id: z.string().uuid().nullable().optional(),
  workstation_id: z.string().uuid().nullable().optional(),
  assigned_worker_id: z.string().uuid().nullable().optional(),
  wage_rule_id: z.string().uuid().nullable().optional(),
  remark: z.string().trim().max(2000).nullable().optional(),
}).strict();

function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) {
    return Response.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('product_task.create_failed', { error });
  return Response.json({ success: false, error: '新增生产任务失败' }, { status: 500 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.plan');
    const { id: productId } = await parseParams(params, paramsSchema);
    const input = await parseJson(request, createTaskSchema);
    const supabase = await createClient();
    const { data: product, error: productError } = await supabase.from('order_products')
      .select('id,order_id,space_id,product_no,product_name,product_type,material,color')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', productId)
      .maybeSingle();
    if (productError) return Response.json({ success: false, error: '查询产品失败' }, { status: 500 });
    if (!product) return Response.json({ success: false, error: '产品不存在' }, { status: 404 });

    if (input.assigned_worker_id) {
      const { data: worker, error: workerError } = await supabase.from('workers')
        .select('id')
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', input.assigned_worker_id)
        .eq('status', 'active')
        .maybeSingle();
      if (workerError || !worker) {
        return Response.json({ success: false, error: '指派工人不可用' }, { status: 422 });
      }
      requirePermission(context, 'production.assign');
    }

    const { count, error: countError } = await supabase.from('production_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('enterprise_id', context.enterpriseId)
      .eq('product_id', productId);
    if (countError) return Response.json({ success: false, error: '生成任务编号失败' }, { status: 500 });
    const taskNo = `${product.product_no}-T${String((count ?? 0) + 1).padStart(2, '0')}`;

    const draftTask = {
      enterprise_id: context.enterpriseId,
      order_id: product.order_id,
      space_id: product.space_id,
      product_id: productId,
      task_no: taskNo,
      task_type: input.task_type,
      task_name: input.task_name,
      task_code: input.task_code || null,
      product_name: product.product_name,
      product_type: product.product_type,
      quantity: input.quantity,
      unit: input.unit,
      length: input.length ?? null,
      width: input.width ?? null,
      thickness: input.thickness ?? null,
      area: input.area ?? null,
      material: input.material || product.material,
      color: input.color || product.color,
      process_name: input.process_name || null,
      workshop_id: input.workshop_id || null,
      workstation_id: input.workstation_id || null,
      assigned_worker_id: input.assigned_worker_id || null,
      worker_id: input.assigned_worker_id || null,
      wage_rule_id: input.wage_rule_id || null,
      remark: input.remark || null,
    };

    let estimatedWage = 0;
    if (input.wage_rule_id) {
      const { data: wageRule, error: wageRuleError } = await supabase.from('wage_rules')
        .select('id,calculation_method,unit_price,extra_amount,task_type,product_type,process_name,scope_type,worker_id,position_id,role_scope,enabled')
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', input.wage_rule_id)
        .eq('enabled', true)
        .maybeSingle();
      if (wageRuleError || !wageRule) {
        return Response.json({ success: false, error: '计件规则不可用' }, { status: 422 });
      }
      estimatedWage = calculateTaskWage(draftTask, wageRule);
    }

    const { data, error } = await supabase.from('production_tasks').insert({
      ...draftTask,
      estimated_wage_amount: estimatedWage,
      final_wage_amount: 0,
      status: input.assigned_worker_id ? 'assigned' : 'pending_assign',
      updated_at: new Date().toISOString(),
    }).select('id,order_id,space_id,product_id,task_no,task_type,task_name,task_code,product_name,quantity,unit,length,width,thickness,area,material,color,process_name,status,workshop_id,workstation_id,created_at,updated_at').single();
    if (error || !data) return Response.json({ success: false, error: '新增生产任务失败' }, { status: 500 });
    const { error: logError } = await supabase.from('order_status_logs').insert({
      enterprise_id: context.enterpriseId,
      target_type: 'production_task',
      target_id: data.id,
      from_status: null,
      to_status: data.status,
      changed_by: context.userId,
      remark: '新增生产任务',
    });
    if (logError) console.error('product_task.status_log_failed', { code: logError.code });
    return Response.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}
