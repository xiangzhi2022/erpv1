import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageWages } from '@/lib/four-level-order';
import {
  createOrUpdatePendingWageRecord,
  resolveWageRuleForTask,
  syncOrderProgressFromTask,
  writeStatusLog,
} from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageWages(user)) return jsonError('无权审核工资', 403);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { approved?: boolean; action?: 'approve' | 'rework' | 'abnormal'; remark?: string };
    const action = body.action || (body.approved === false ? 'rework' : 'approve');
    if (!['approve', 'rework', 'abnormal'].includes(action)) return jsonError('审核动作无效', 400);
    const approved = action === 'approve';
    const supabase = getSupabaseClient();
    const { data: task } = await supabase.from('production_tasks').select('*').eq('id', id).maybeSingle();
    if (!task) return jsonError('生产任务不存在', 404);
    if (user.tenant_id && task.tenant_id && task.tenant_id !== user.tenant_id) return jsonError('无权操作该任务', 403);

    const previousStatus = String(task.status || 'submitted');
    if (previousStatus !== 'submitted' && previousStatus !== 'pending_quality_check') return jsonError('当前状态不能审核', 409);
    const nextStatus = action === 'approve' ? 'completed' : action === 'rework' ? 'reworking' : 'abnormal';
    let finalWageAmount: number | null = null;

    if (approved) {
      const existingWage = await supabase
        .from('worker_wage_records')
        .select('*')
        .eq('task_id', id)
        .maybeSingle();
      let wageRecord = existingWage.data as Record<string, unknown> | null;
      if (!wageRecord) {
        const wageRule = await resolveWageRuleForTask(supabase, task as Record<string, unknown>);
        if (!wageRule) return jsonError('该任务还没有匹配的工资规则，请先配置工资规则后再审核', 409);
        wageRecord = await createOrUpdatePendingWageRecord(supabase, task as Record<string, unknown>, wageRule, user.id);
      }
      if (!wageRecord) return jsonError('工资记录生成失败，请检查工人和工资规则配置', 409);
      const parsedWage = Number(wageRecord.wage_amount || 0);
      finalWageAmount = Number.isFinite(parsedWage) ? parsedWage : 0;
    }

    const updateData: Record<string, unknown> = {
      status: nextStatus,
      completed_at: approved ? new Date().toISOString() : null,
      end_date: approved ? new Date().toISOString() : null,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (approved) updateData.final_wage_amount = finalWageAmount;

    const { data, error } = await supabase
      .from('production_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);

    const wageStatus = approved ? 'approved' : 'rejected';
    const wageUpdate = await supabase
      .from('worker_wage_records')
      .update({
        status: wageStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('task_id', id)
      .in('status', ['pending', 'rejected'])
      .select('id, status');

    await writeStatusLog(
      supabase,
      'production_task',
      id,
      previousStatus,
      nextStatus,
      user.id,
      body.remark || (action === 'approve' ? '主管审核通过' : action === 'rework' ? '主管驳回返工' : '主管标记异常')
    );
    for (const record of ((wageUpdate.data || []) as Record<string, unknown>[])) {
      await writeStatusLog(
        supabase,
        'wage_record',
        String(record.id),
        'pending',
        wageStatus,
        user.id,
        action === 'approve' ? '工资审核通过' : '任务未通过，工资驳回'
      );
    }
    await syncOrderProgressFromTask(supabase, id, user.id, body.remark || null);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('approve task failed:', error);
    return jsonError('审核任务失败', 500);
  }
}
