import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canEditFinancialFields } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

const PATCH_FIELDS = [
  'total_amount',
  'cost_amount',
  'profit_amount',
  'deposit_amount',
  'material_cost',
  'hardware_cost',
  'quote_status',
  'settlement_status',
  'finance_remark',
];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canEditFinancialFields(user)) return jsonError('无权编辑财务字段', 403);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of PATCH_FIELDS) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }
    const supabase = getSupabaseClient();
    let query = supabase.from('orders').update(updateData).eq('id', id);
    if (user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const { data, error } = await query.select().single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update finance pricing failed:', error);
    return jsonError('更新财务价格失败', 500);
  }
}
