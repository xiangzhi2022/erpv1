import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageWages, isProductionTaskType, isWageCalculationMethod } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

const PATCH_FIELDS = ['rule_name', 'process_name', 'unit', 'unit_price', 'role_scope', 'enabled'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageWages(user)) return jsonError('无权修改工资规则', 403);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    PATCH_FIELDS.forEach((key) => {
      if (body[key] !== undefined) updateData[key] = body[key];
    });
    if (typeof body.task_type === 'string') {
      if (!isProductionTaskType(body.task_type)) return jsonError('任务类型无效', 400);
      updateData.task_type = body.task_type;
    }
    if (typeof body.calculation_method === 'string') {
      if (!isWageCalculationMethod(body.calculation_method)) return jsonError('计算方式无效', 400);
      updateData.calculation_method = body.calculation_method;
    }
    const supabase = getSupabaseClient();
    let query = supabase.from('wage_rules').update(updateData).eq('id', id);
    if (user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const { data, error } = await query.select().single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update wage rule failed:', error);
    return jsonError('修改工资规则失败', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageWages(user)) return jsonError('无权删除工资规则', 403);
    const { id } = await params;
    const supabase = getSupabaseClient();
    let query = supabase.from('wage_rules').delete().eq('id', id);
    if (user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const { error } = await query;
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true });
  } catch (error) {
    console.error('delete wage rule failed:', error);
    return jsonError('删除工资规则失败', 500);
  }
}
