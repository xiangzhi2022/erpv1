import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canViewWageSummary } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canViewWageSummary(user)) return jsonError('无权查看工资汇总', 403);
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('worker_id');
    const status = searchParams.get('status');
    let query = supabase
      .from('worker_wage_records')
      .select('*, worker:workers(id,name,worker_no,craft_type,workshop_id), task:production_tasks(id,task_no,task_name,process_name)')
      .order('created_at', { ascending: false });
    if (workerId) query = query.eq('worker_id', workerId);
    if (status && status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    const rows = (data || []) as Record<string, unknown>[];
    const summary = rows.reduce<Record<string, number>>((acc, row) => {
      const rowStatus = String(row.status || 'pending');
      acc[rowStatus] = (acc[rowStatus] || 0) + num(row.wage_amount);
      acc.total = (acc.total || 0) + num(row.wage_amount);
      acc.count = (acc.count || 0) + 1;
      return acc;
    }, { pending: 0, approved: 0, rejected: 0, settled: 0, paid: 0, total: 0, count: 0 });
    return Response.json({ success: true, data: rows, summary });
  } catch (error) {
    console.error('get finance wages failed:', error);
    return jsonError('获取工资汇总失败', 500);
  }
}
