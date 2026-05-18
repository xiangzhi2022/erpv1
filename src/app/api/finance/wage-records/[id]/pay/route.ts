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
    if (!canEditFinancialFields(user)) return jsonError('无权发放工资', 403);
    const { id } = await params;
    const supabase = getSupabaseClient();
    const existing = await supabase.from('worker_wage_records').select('id,status').eq('id', id).maybeSingle();
    if (!existing.data) return jsonError('工资记录不存在', 404);
    if (existing.data.status !== 'settled') return jsonError('只有已结算工资可以发放', 409);
    const { data, error } = await supabase
      .from('worker_wage_records')
      .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    await writeStatusLog(supabase, 'wage_record', id, 'settled', 'paid', user.id, '财务标记工资已发放');
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('pay wage failed:', error);
    return jsonError('工资发放失败', 500);
  }
}
