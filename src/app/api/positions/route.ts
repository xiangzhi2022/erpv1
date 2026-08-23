import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_POSITIONS } from '@/lib/organization';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export async function GET(request: Request) {
  try {
    void request;
    const context = await getEnterpriseContext();
    requirePermission(context, 'organization.read');
    const supabase = await createClient();
    const query = supabase
      .from('positions')
      .select('*, department:departments(id,name,code)')
      .eq('enterprise_id', context.enterpriseId)
      .order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) return jsonError('获取岗位失败', 500);
    return Response.json({ success: true, data: data || [], defaults: DEFAULT_POSITIONS });
  } catch (error) {
    console.error('get positions failed:', error);
    return jsonError('获取岗位失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'organization.manage');
    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const name = text(body.name);
    const code = text(body.code);
    if (!name || !code) return jsonError('岗位名称和编码不能为空', 400);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('positions')
      .insert({
        name,
        code,
        department_id: text(body.department_id),
        position_type: text(body.position_type) || 'general',
        can_receive_production_task: bool(body.can_receive_production_task, false),
        can_calculate_piece_wage: bool(body.can_calculate_piece_wage, false),
        can_review_task: bool(body.can_review_task, false),
        can_assign_task: bool(body.can_assign_task, false),
        default_role_code: text(body.default_role_code),
        status: text(body.status) || 'active',
        enterprise_id: context.enterpriseId,
        remark: text(body.remark),
      })
      .select()
      .single();
    if (error) return jsonError('创建岗位失败', 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create position failed:', error);
    return jsonError('创建岗位失败', 500);
  }
}
