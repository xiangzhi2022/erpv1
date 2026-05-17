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
    if (!canViewWageSummary(user)) return jsonError('无权查看工人工资', 403);
    const { id } = await params;
    const supabase = getSupabaseClient();
    const { data: worker } = await supabase.from('workers').select('*').eq('id', id).maybeSingle();
    if (!worker) return jsonError('工人不存在', 404);
    if (user.tenant_id && worker.tenant_id && worker.tenant_id !== user.tenant_id) return jsonError('无权查看该工人', 403);
    const { data, error } = await supabase
      .from('worker_wage_records')
      .select('*')
      .eq('worker_id', id)
      .order('created_at', { ascending: false });
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, worker, data: data || [] });
  } catch (error) {
    console.error('get worker wages failed:', error);
    return jsonError('获取工人工资失败', 500);
  }
}
