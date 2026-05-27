import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  canManageWageRules,
  defaultWageCalculationMethod,
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

function scopedTenantId(userTenantId: string | undefined, requestedTenantId: string | null): string | null {
  return userTenantId || requestedTenantId || null;
}

async function loadWageRuleOptions(supabase: ReturnType<typeof getSupabaseClient>, tenantId: string | null) {
  const [workersRes, positionsRes] = await Promise.all([
    tenantId
      ? supabase.from('workers').select('id,name,worker_no,craft_type,tenant_id').eq('tenant_id', tenantId).order('name', { ascending: true })
      : supabase.from('workers').select('id,name,worker_no,craft_type,tenant_id').order('name', { ascending: true }),
    tenantId
      ? supabase.from('positions').select('id,name,code,position_type,tenant_id').or(`tenant_id.is.null,tenant_id.eq.${tenantId}`).order('name', { ascending: true })
      : supabase.from('positions').select('id,name,code,position_type,tenant_id').order('name', { ascending: true }),
  ]);

  return {
    workers: workersRes.data || [],
    positions: positionsRes.data || [],
  };
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageWageRules(user)) return jsonError('无权查看工资管理规则', 403);

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const tenantId = scopedTenantId(user.tenant_id, text(searchParams.get('tenant_id')));
    let query = supabase.from('wage_rules').select('*').order('created_at', { ascending: false });
    if (tenantId) query = query.eq('tenant_id', tenantId);

    const taskType = searchParams.get('task_type');
    if (taskType) query = query.eq('task_type', taskType);
    const scopeType = searchParams.get('scope_type');
    if (scopeType) query = query.eq('scope_type', scopeType);

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);

    const includeOptions = searchParams.get('include_options') === '1';
    const options = includeOptions ? await loadWageRuleOptions(supabase, tenantId) : undefined;
    return Response.json({ success: true, data: data || [], options });
  } catch (error) {
    console.error('get wage rules failed:', error);
    return jsonError('获取工资管理规则失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageWageRules(user)) return jsonError('无权创建工资管理规则', 403);

    const body = (await request.json()) as Record<string, unknown>;
    const ruleName = text(body.rule_name);
    const taskType = text(body.task_type);
    const productType = text(body.product_type);
    const scopeType = text(body.scope_type) || 'company';
    const method = text(body.calculation_method) || defaultWageCalculationMethod(taskType || productType);
    const tenantId = scopedTenantId(user.tenant_id, text(body.tenant_id));

    if (!tenantId) return jsonError('工资规则必须归属到工厂企业', 400);
    if (!ruleName) return jsonError('规则名称不能为空', 400);
    if (!taskType || !isProductionTaskType(taskType)) return jsonError('拆单任务类型无效', 400);
    if (!isWageCalculationMethod(method)) return jsonError('计算方式无效', 400);
    if (!isWageRuleScopeType(scopeType)) return jsonError('适用范围无效', 400);
    if (scopeType === 'worker' && !text(body.worker_id)) return jsonError('个人规则必须选择工人', 400);
    if (scopeType === 'position' && !text(body.position_id)) return jsonError('岗位规则必须选择岗位', 400);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('wage_rules')
      .insert({
        tenant_id: tenantId,
        rule_name: ruleName,
        task_type: taskType,
        process_name: text(body.process_name),
        unit: text(body.unit) || '件',
        unit_price: numberValue(body.unit_price),
        calculation_method: method,
        role_scope: text(body.role_scope),
        scope_type: scopeType,
        worker_id: scopeType === 'worker' ? text(body.worker_id) : null,
        position_id: scopeType === 'position' ? text(body.position_id) : null,
        product_type: productType,
        extra_amount: numberValue(body.extra_amount),
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
    return jsonError('创建工资管理规则失败', 500);
  }
}
