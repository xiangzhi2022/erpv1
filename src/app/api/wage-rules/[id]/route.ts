import { parseJsonObject } from '@/lib/api/request';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  canManageWageRules,
  isProductionTaskType,
  isWageCalculationMethod,
  isWageRuleScopeType,
} from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const PATCH_FIELDS = ['rule_name', 'process_name', 'unit', 'unit_price', 'role_scope', 'enabled', 'product_type', 'extra_amount'] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageWageRules(user)) return jsonError('无权修改工资管理规则', 403);

    const { id } = await params;
    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    PATCH_FIELDS.forEach((key) => {
      if (body[key] !== undefined) updateData[key] = key === 'unit_price' || key === 'extra_amount' ? numberValue(body[key]) : body[key];
    });

    if (typeof body.task_type === 'string') {
      if (!isProductionTaskType(body.task_type)) return jsonError('拆单任务类型无效', 400);
      updateData.task_type = body.task_type;
    }
    if (typeof body.calculation_method === 'string') {
      if (!isWageCalculationMethod(body.calculation_method)) return jsonError('计算方式无效', 400);
      updateData.calculation_method = body.calculation_method;
    }
    if (typeof body.scope_type === 'string') {
      if (!isWageRuleScopeType(body.scope_type)) return jsonError('适用范围无效', 400);
      updateData.scope_type = body.scope_type;
      updateData.worker_id = body.scope_type === 'worker' ? text(body.worker_id) : null;
      updateData.position_id = body.scope_type === 'position' ? text(body.position_id) : null;
    } else {
      if (body.worker_id !== undefined) updateData.worker_id = text(body.worker_id);
      if (body.position_id !== undefined) updateData.position_id = text(body.position_id);
    }

    const nextScope = String(updateData.scope_type || body.scope_type || '');
    if (nextScope === 'worker' && !text(updateData.worker_id ?? body.worker_id)) return jsonError('个人规则必须选择工人', 400);
    if (nextScope === 'position' && !text(updateData.position_id ?? body.position_id)) return jsonError('岗位规则必须选择岗位', 400);

    const supabase = getSupabaseClient();
    let query = supabase.from('wage_rules').update(updateData).eq('id', id);
    if (user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const { data, error } = await query.select().single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update wage rule failed:', error);
    return jsonError('修改工资管理规则失败', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageWageRules(user)) return jsonError('无权删除工资管理规则', 403);

    const { id } = await params;
    const supabase = getSupabaseClient();
    let query = supabase.from('wage_rules').delete().eq('id', id);
    if (user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const { error } = await query;
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true });
  } catch (error) {
    console.error('delete wage rule failed:', error);
    return jsonError('删除工资管理规则失败', 500);
  }
}
