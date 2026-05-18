import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageProduction } from '@/lib/four-level-order';
import { resolveEligibleProductionWorkers } from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageProduction(user)) return jsonError('无权查看可分配工人', 403);

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');
    let task: Record<string, unknown> | null = null;

    if (taskId) {
      const { data, error } = await supabase.from('production_tasks').select('*').eq('id', taskId).maybeSingle();
      if (error) return jsonError(error.message, 500);
      if (!data) return jsonError('生产任务不存在', 404);
      if (user.tenant_id && data.tenant_id && data.tenant_id !== user.tenant_id) return jsonError('无权查看该任务工人', 403);
      task = data as Record<string, unknown>;
    } else {
      task = {
        task_type: searchParams.get('task_type') || null,
        process_name: searchParams.get('process_name') || null,
        tenant_id: user.tenant_id || null,
      };
    }

    const workers = await resolveEligibleProductionWorkers(supabase, user, task);
    return Response.json({
      success: true,
      data: workers.map((worker) => ({
        id: worker.id,
        name: worker.name,
        worker_no: worker.worker_no,
        craft_type: worker.craft_type,
        workshop_id: worker.workshop_id,
        score: worker.score,
        match_reasons: worker.match_reasons,
      })),
    });
  } catch (error) {
    console.error('get eligible production workers failed:', error);
    return jsonError('获取可分配工人失败', 500);
  }
}
