import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canViewWageSummary } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canViewWageSummary(user)) return jsonError('无权查看绩效', 403);
    const { id } = await params;
    const supabase = getSupabaseClient();
    const { data: worker } = await supabase.from('workers').select('*').eq('id', id).maybeSingle();
    if (!worker) return jsonError('工人不存在', 404);
    if (user.tenant_id && worker.tenant_id && worker.tenant_id !== user.tenant_id) return jsonError('无权查看该工人', 403);
    const [tasksRes, wagesRes] = await Promise.all([
      supabase.from('production_tasks').select('*').or(`assigned_worker_id.eq.${id},worker_id.eq.${id}`).order('created_at', { ascending: false }),
      supabase.from('worker_wage_records').select('*').eq('worker_id', id).order('created_at', { ascending: false }),
    ]);
    if (tasksRes.error) return jsonError(tasksRes.error.message, 500);
    if (wagesRes.error) return jsonError(wagesRes.error.message, 500);
    return Response.json({ success: true, worker, tasks: tasksRes.data || [], wages: wagesRes.data || [] });
  } catch (error) {
    console.error('get worker performance detail failed:', error);
    return jsonError('获取绩效详情失败', 500);
  }
}
