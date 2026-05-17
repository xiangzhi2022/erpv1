import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageWages, isProductionTaskType, isWageCalculationMethod } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageWages(user)) return jsonError('无权查看工资规则', 403);
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    let query = supabase.from('wage_rules').select('*').order('created_at', { ascending: false });
    if (user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const taskType = searchParams.get('task_type');
    if (taskType) query = query.eq('task_type', taskType);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('get wage rules failed:', error);
    return jsonError('获取工资规则失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageWages(user)) return jsonError('无权创建工资规则', 403);
    const body = (await request.json()) as Record<string, unknown>;
    const ruleName = text(body.rule_name);
    const taskType = text(body.task_type);
    const method = text(body.calculation_method) || 'by_piece';
    if (!ruleName) return jsonError('规则名称不能为空', 400);
    if (!taskType || !isProductionTaskType(taskType)) return jsonError('任务类型无效', 400);
    if (!isWageCalculationMethod(method)) return jsonError('计算方式无效', 400);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('wage_rules')
      .insert({
        tenant_id: user.tenant_id || null,
        rule_name: ruleName,
        task_type: taskType,
        process_name: text(body.process_name),
        unit: text(body.unit) || '件',
        unit_price: body.unit_price ?? 0,
        calculation_method: method,
        role_scope: text(body.role_scope),
        enabled: body.enabled !== false,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create wage rule failed:', error);
    return jsonError('创建工资规则失败', 500);
  }
}
