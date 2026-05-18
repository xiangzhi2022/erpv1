import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { calculateTaskWage, canManageProduction } from '@/lib/four-level-order';
import {
  ensureWorkerCanReceiveProductionTask,
  resolveWageRuleForTask,
  writeStatusLog,
} from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageProduction(user)) return jsonError('无权分配任务', 403);
    const { id } = await params;
    const body = (await request.json()) as { assigned_worker_id?: string; workshop_id?: string; workstation_id?: string };
    if (!body.assigned_worker_id) return jsonError('请选择工人', 400);
    const supabase = getSupabaseClient();
    const { data: task } = await supabase.from('production_tasks').select('*').eq('id', id).maybeSingle();
    if (!task) return jsonError('生产任务不存在', 404);
    if (user.tenant_id && task.tenant_id && task.tenant_id !== user.tenant_id) return jsonError('无权操作该任务', 403);

    const taskRow = task as Record<string, unknown>;
    const previousStatus = String(task.status || 'pending_assign');
    try {
      await ensureWorkerCanReceiveProductionTask(supabase, user, body.assigned_worker_id, taskRow);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : '所选工人不可接收该任务', 400);
    }
    const assignedTask: Record<string, unknown> = {
      ...taskRow,
      assigned_worker_id: body.assigned_worker_id,
      worker_id: body.assigned_worker_id,
      workshop_id: body.workshop_id || task.workshop_id || null,
      workstation_id: body.workstation_id || task.workstation_id || null,
      status: 'assigned',
    };
    const wageRule = await resolveWageRuleForTask(supabase, assignedTask);
    const estimatedWage = wageRule
      ? calculateTaskWage({
          quantity: taskRow.quantity as number | string | null | undefined,
          area: taskRow.area as number | string | null | undefined,
          length: taskRow.length as number | string | null | undefined,
          meter_count: taskRow.meter_count as number | string | null | undefined,
        }, wageRule)
      : null;
    const updateData: Record<string, unknown> = {
      assigned_worker_id: body.assigned_worker_id,
      worker_id: body.assigned_worker_id,
      workshop_id: body.workshop_id || task.workshop_id || null,
      workstation_id: body.workstation_id || task.workstation_id || null,
      status: 'assigned',
      updated_at: new Date().toISOString(),
    };
    if (wageRule) {
      updateData.wage_rule_id = wageRule.id;
      updateData.estimated_wage_amount = estimatedWage;
    }

    const { data, error } = await supabase
      .from('production_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    await writeStatusLog(supabase, 'production_task', id, previousStatus, 'assigned', user.id, '分配生产任务');
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('assign task failed:', error);
    return jsonError('分配任务失败', 500);
  }
}
