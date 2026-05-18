import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canOperateWorkerTask } from '@/lib/four-level-order';
import { getWorkerForUser } from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function amount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = date.getDay() || 7;
  const start = startOfDay(date);
  start.setDate(start.getDate() - day + 1);
  return start;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canOperateWorkerTask(user)) return jsonError('无权查看工资', 403);
    const supabase = getSupabaseClient();
    const worker = await getWorkerForUser(supabase, user);
    if (!worker) return Response.json({ success: true, worker: null, data: [], summary: { pending: 0, approved: 0, settled: 0, paid: 0, month_total: 0 } });
    const { data, error } = await supabase
      .from('worker_wage_records')
      .select('*, task:production_tasks(id, task_no, task_name, process_name)')
      .eq('worker_id', String(worker.id))
      .order('created_at', { ascending: false });
    if (error) return jsonError(error.message, 500);
    const rows = (data || []) as Record<string, unknown>[];
    const now = new Date();
    const todayStart = startOfDay(now).getTime();
    const weekStart = startOfWeek(now).getTime();
    const monthPrefix = now.toISOString().slice(0, 7);
    const summary = rows.reduce<Record<string, number>>((acc, row) => {
      const status = String(row.status || 'pending');
      const createdAt = new Date(String(row.created_at || '')).getTime();
      const wageAmount = amount(row.wage_amount);
      acc[status] = (acc[status] || 0) + amount(row.wage_amount);
      if (Number.isFinite(createdAt) && createdAt >= todayStart) acc.today_total += wageAmount;
      if (Number.isFinite(createdAt) && createdAt >= weekStart) acc.week_total += wageAmount;
      if (String(row.created_at || '').startsWith(monthPrefix)) acc.month_total += wageAmount;
      return acc;
    }, { pending: 0, approved: 0, rejected: 0, settled: 0, paid: 0, today_total: 0, week_total: 0, month_total: 0 });
    const sanitizedRows = rows.map((row) => {
      const copy = { ...row };
      delete copy.unit_price;
      delete copy.wage_rule_id;
      return copy;
    });
    return Response.json({ success: true, worker, data: sanitizedRows, summary });
  } catch (error) {
    console.error('get my wages failed:', error);
    return jsonError('获取我的工资失败', 500);
  }
}
