import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageProduction } from '@/lib/four-level-order';
import { canSeeOrder, loadOrderTree, writeStatusLog } from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageProduction(user)) return jsonError('无权确认拆单', 403);

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const supabase = getSupabaseClient();
    const tree = await loadOrderTree(supabase, id);
    if (!tree) return jsonError('订单不存在', 404);
    if (!canSeeOrder(user, tree)) return jsonError('无权操作该订单', 403);

    const { data: draftTasks, error: taskQueryError } = await supabase
      .from('production_tasks')
      .select('id, status')
      .eq('order_id', id)
      .eq('status', 'pending_generate');
    if (taskQueryError) return jsonError(taskQueryError.message, 500);

    const tasks = (draftTasks || []) as Array<{ id: string; status: string | null }>;
    if (tasks.length === 0) {
      return Response.json({ success: true, updated_tasks: 0, message: '没有待确认的生产草稿任务' });
    }

    const now = new Date().toISOString();
    const taskIds = tasks.map((task) => task.id);
    const { data: updatedTasks, error: updateError } = await supabase
      .from('production_tasks')
      .update({ status: 'pending_assign', updated_at: now })
      .in('id', taskIds)
      .select('*');
    if (updateError) return jsonError(updateError.message, 500);

    await Promise.all(
      tasks.map((task) =>
        writeStatusLog(
          supabase,
          'production_task',
          task.id,
          text(task.status) || 'pending_generate',
          'pending_assign',
          user.id,
          '确认拆单，进入待分配'
        )
      )
    );

    const currentStatus = text(tree.status);
    if (currentStatus && ['pending', 'confirmed', 'accepted', 'reviewed', 'draft'].includes(currentStatus)) {
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'pool', updated_at: now })
        .eq('id', id);
      if (!orderError) {
        await writeStatusLog(
          supabase,
          'order',
          id,
          currentStatus,
          'pool',
          user.id,
          text(body.remark) || '确认拆单，订单进入待排产'
        );
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
