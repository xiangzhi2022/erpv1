import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canEditFinancialFields, canViewFinancialFields } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canViewFinancialFields(user)) return jsonError('无权查看结算', 403);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('worker_wage_records')
      .select('id, worker_id, wage_amount, status, approved_at, paid_at, created_at, worker:workers(id,name,worker_no)')
      .in('status', ['settled', 'paid'])
      .order('updated_at', { ascending: false });
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('get settlements failed:', error);
    return jsonError('获取结算记录失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canEditFinancialFields(user)) return jsonError('无权创建结算', 403);
    const body = (await request.json()) as { record_ids?: string[] };
    const recordIds = Array.isArray(body.record_ids) ? body.record_ids.filter((id): id is string => typeof id === 'string') : [];
    if (recordIds.length === 0) return jsonError('请选择工资记录', 400);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('worker_wage_records')
      .update({ status: 'settled', updated_at: new Date().toISOString() })
      .in('id', recordIds)
      .eq('status', 'approved')
      .select();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('create settlement failed:', error);
    return jsonError('创建结算失败', 500);
  }
}
