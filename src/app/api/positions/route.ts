import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { DEFAULT_POSITIONS } from '@/lib/organization';
import { canAccessPath, getUserPermissionKeys, isAdminRole } from '@/lib/role-access';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function canManageOrganization(user: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>): boolean {
  return isAdminRole(user) || getUserPermissionKeys(user).includes('factory_boss');
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/settings/positions')) return jsonError('无权查看岗位', 403);

    const supabase = getSupabaseClient();
    let query = supabase
      .from('positions')
      .select('*, department:departments(id,name,code)')
      .order('created_at', { ascending: false });
    if (user.tenant_id) query = query.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data: data || [], defaults: DEFAULT_POSITIONS });
  } catch (error) {
    console.error('get positions failed:', error);
    return jsonError('获取岗位失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageOrganization(user)) return jsonError('无权创建岗位', 403);
    const body = (await request.json()) as Record<string, unknown>;
    const name = text(body.name);
    const code = text(body.code);
    if (!name || !code) return jsonError('岗位名称和编码不能为空', 400);

    const supabase = getSupabaseClient();
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
        tenant_id: user.tenant_id || null,
        remark: text(body.remark),
      })
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create position failed:', error);
    return jsonError('创建岗位失败', 500);
  }
}
