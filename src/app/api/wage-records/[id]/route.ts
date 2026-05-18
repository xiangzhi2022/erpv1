import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canViewWageSummary } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canViewWageSummary(user)) return jsonError('无权修改工资记录', 403);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ['status', 'wage_amount', 'quantity', 'unit_price', 'approved_by', 'approved_at', 'paid_at']) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('worker_wage_records').update(updateData).eq('id', id).select().single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update wage record failed:', error);
    return jsonError('修改工资记录失败', 500);
  }
}
