import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  calculateTaskWage,
  canEditOrderContent,
  canManageProduction,
  isProductionTaskType,
} from '@/lib/four-level-order';
import {
  canSeeOrder,
  loadOrderTree,
  resolveWageRuleForTask,
  writeStatusLog,
} from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageProduction(user) && !canEditOrderContent(user)) return jsonError('无权新增生产任务', 403);

    const { id: productId } = await params;
    const supabase = getSupabaseClient();
    const { data: product } = await supabase.from('order_products').select('*').eq('id', productId).maybeSingle();
    if (!product) return jsonError('产品不存在', 404);
    const tree = await loadOrderTree(supabase, String(product.order_id));
    if (!tree) return jsonError('订单不存在', 404);
    if (!canSeeOrder(user, tree)) return jsonError('无权操作该订单', 403);

    const body = (await request.json()) as Record<string, unknown>;
    const taskName = text(body.task_name);
    if (!taskName) return jsonError('任务名称不能为空', 400);
    const taskType = text(body.task_type) || 'process';
    if (!isProductionTaskType(taskType)) return jsonError('任务类型无效', 400);

    const { count } = await supabase
      .from('production_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);
    const nextIndex = (count || 0) + 1;
    const taskNo = `${String(product.product_no || tree.order_no)}-T${String(nextIndex).padStart(2, '0')}`;
    const draftTask = {
      order_id: String(product.order_id),
      space_id: String(product.space_id),
      product_id: productId,
      task_no: taskNo,
      task_type: taskType,
      task_name: taskName,
      task_code: text(body.task_code),
      product_name: String(product.product_name || taskName),
      quantity: Number(body.quantity || 1),
      unit: text(body.unit) || '件',
      length: numberValue(body.length),
      width: numberValue(body.width),
      thickness: numberValue(body.thickness),
      area: numberValue(body.area),
      material: text(body.material) || text(product.material),
      color: text(body.color) || text(product.color),
      process_name: text(body.process_name),
      status: 'pending_assign',
      workshop_id: text(body.workshop_id),
      workstation_id: text(body.workstation_id),
      assigned_worker_id: text(body.assigned_worker_id),
      worker_id: text(body.assigned_worker_id),
      tenant_id: user.tenant_id || tree.to_tenant_id || tree.tenant_id || null,
      wage_rule_id: text(body.wage_rule_id),
      remark: text(body.remark),
      updated_at: new Date().toISOString(),
    };
    const wageRule = await resolveWageRuleForTask(supabase, draftTask);
    const estimatedWage = wageRule ? calculateTaskWage(draftTask, wageRule) : 0;
    const insertData = {
      ...draftTask,
      estimated_wage_amount: estimatedWage,
      final_wage_amount: 0,
      status: draftTask.assigned_worker_id ? 'assigned' : 'pending_assign',
    };

    const { data, error } = await supabase.from('production_tasks').insert(insertData).select().single();
    if (error) return jsonError(error.message, 500);
    await writeStatusLog(supabase, 'production_task', String(data.id), null, String(data.status), user.id, '新增生产任务');
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create production task failed:', error);
    return jsonError('新增生产任务失败', 500);
  }
}
