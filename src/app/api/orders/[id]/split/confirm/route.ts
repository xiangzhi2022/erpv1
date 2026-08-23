import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.plan');

    const { id } = await params;
    const body = (await parseJsonObject(request).catch(() => ({}))) as Record<string, unknown>;
    const supabase = await createClient();
    const { data: order } = await supabase.from('orders').select('id,status')
      .eq('enterprise_id', context.enterpriseId).eq('id', id).maybeSingle();
    if (!order) return jsonError('订单不存在', 404);

    const { data: draftTasks, error: taskQueryError } = await supabase
      .from('production_tasks')
      .select('id, status')
      .eq('enterprise_id', context.enterpriseId)
      .eq('order_id', id)
      .eq('status', 'pending_generate');
    if (taskQueryError) return jsonError('查询生产任务失败', 500);

    const tasks = (draftTasks || []) as Array<{ id: string; status: string | null }>;
    if (tasks.length === 0) {
      return Response.json({ success: true, updated_tasks: 0, message: '没有待确认的生产草稿任务' });
    }

    const now = new Date().toISOString();
    const taskIds = tasks.map((task) => task.id);
    const { data: updatedTasks, error: updateError } = await supabase
      .from('production_tasks')
      .update({ status: 'pending_assign', updated_at: now })
      .eq('enterprise_id', context.enterpriseId)
      .in('id', taskIds)
      .select('*');
    if (updateError) return jsonError('确认生产任务失败', 500);

    await Promise.all(
      tasks.map((task) =>
        supabase.from('order_status_logs').insert({
          enterprise_id: context.enterpriseId,
          target_type: 'production_task',
          target_id: task.id,
          from_status: text(task.status) || 'pending_generate',
          to_status: 'pending_assign',
          changed_by: context.userId,
          remark: '确认拆单，进入待分配',
        })
      )
    );

    const currentStatus = text(order.status);
    if (currentStatus && ['pending', 'confirmed', 'accepted', 'reviewed', 'draft'].includes(currentStatus)) {
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'pool', updated_at: now })
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', id);
      if (!orderError) {
        await supabase.from('order_status_logs').insert({
          enterprise_id: context.enterpriseId,
          target_type: 'order',
          target_id: id,
          from_status: currentStatus,
          to_status: 'pool',
          changed_by: context.userId,
          remark: text(body.remark) || '确认拆单，订单进入待排产',
        });
      }
    }

    return Response.json({
      success: true,
      updated_tasks: (updatedTasks || []).length,
      data: updatedTasks || [],
    });
  } catch (error) {
    console.error('confirm split failed:', error);
    return jsonError('确认拆单失败', 500);
  }
}
