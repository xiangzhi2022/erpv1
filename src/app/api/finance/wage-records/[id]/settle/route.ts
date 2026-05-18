import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canEditFinancialFields } from '@/lib/four-level-order';
import { writeStatusLog } from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canEditFinancialFields(user)) return jsonError('无权结算工资', 403);
    const { id } = await params;
    const supabase = getSupabaseClient();
    const existing = await supabase.from('worker_wage_records').select('id,status').eq('id', id).maybeSingle();
    if (!existing.data) return jsonError('工资记录不存在', 404);
    if (existing.data.status !== 'approved') return jsonError('只有已确认工资可以结算', 409);
    const { data, error } = await supabase
      .from('worker_wage_records')
      .update({ status: 'settled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    await writeStatusLog(supabase, 'wage_record', id, 'approved', 'settled', user.id, '财务结算工资');
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('settle wage failed:', error);
    return jsonError('工资结算失败', 500);
  }
}
