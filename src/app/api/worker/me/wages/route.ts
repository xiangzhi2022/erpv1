import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

function amount(value: number | null | undefined): number { return Number.isFinite(value) ? Number(value) : 0; }
function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('worker_me_wages.request_failed', { error });
  return NextResponse.json({ success: false, error: '获取我的工资失败' }, { status: 500 });
}

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.read.self');
    const supabase = await createClient();
    const { data: worker, error: workerError } = await supabase.from('workers').select('id,worker_no,name,status')
      .eq('enterprise_id', context.enterpriseId).eq('user_id', context.userId).maybeSingle();
    if (workerError) throw workerError;
    if (!worker) return NextResponse.json({ success: true, worker: null, data: [], summary: { pending: 0, approved: 0, rejected: 0, settled: 0, paid: 0, today_total: 0, week_total: 0, month_total: 0 } });
    const { data, error } = await supabase.from('worker_wage_records')
      .select('id,task_id,wage_amount,status,quantity,created_at,submitted_at,approved_at,paid_at,task:production_tasks(id,task_no,task_name,process_name)')
      .eq('enterprise_id', context.enterpriseId).eq('worker_id', worker.id).order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() || 7) - 1)).getTime();
    const month = now.toISOString().slice(0, 7);
    const summary = rows.reduce<Record<string, number>>((total, wage) => {
      const wageAmount = amount(wage.wage_amount); const createdAt = new Date(wage.created_at).getTime();
      total[wage.status] = (total[wage.status] ?? 0) + wageAmount;
      if (createdAt >= dayStart) total.today_total += wageAmount;
      if (createdAt >= weekStart) total.week_total += wageAmount;
      if (wage.created_at.startsWith(month)) total.month_total += wageAmount;
      return total;
    }, { pending: 0, approved: 0, rejected: 0, settled: 0, paid: 0, today_total: 0, week_total: 0, month_total: 0 });
    return NextResponse.json({ success: true, worker, data: rows, summary });
  } catch (error) { return errorResponse(error); }
}
