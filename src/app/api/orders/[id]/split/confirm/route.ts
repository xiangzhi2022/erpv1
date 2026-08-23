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

    const { data: updatedTasks, error: updateError } = await supabase.rpc('confirm_order_task_drafts' as never, {
      target_enterprise_id: context.enterpriseId,
      target_order_id: id,
      target_expected_status: order.status,
      target_remark: text(body.remark) || '确认拆单，订单进入待排产',
    } as never);
    if (updateError) {
      return jsonError(
        updateError.code === 'P0002' ? '订单不存在' : updateError.code === 'P0001' ? '订单或任务状态已变化' : '确认生产任务失败',
        updateError.code === 'P0002' ? 404 : updateError.code === 'P0001' ? 409 : updateError.code === '42501' ? 403 : 500,
      );
    }
    const rpcResult = updatedTasks as unknown;
    const confirmedTasks = rpcResult && typeof rpcResult === 'object'
      && 'tasks' in rpcResult && Array.isArray(rpcResult.tasks)
      ? rpcResult.tasks
      : [];
    if (confirmedTasks.length === 0) {
      return Response.json({ success: true, updated_tasks: 0, message: '没有待确认的生产草稿任务' });
    }

    return Response.json({
      success: true,
      updated_tasks: confirmedTasks.length,
      data: confirmedTasks,
    });
  } catch (error) {
    console.error('confirm split failed:', error);
    return jsonError('确认拆单失败', 500);
  }
}
