import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { DEFAULT_DEPARTMENTS } from '@/lib/organization';
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

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/settings/departments')) return jsonError('无权查看部门', 403);

    const supabase = getSupabaseClient();
    let query = supabase.from('departments').select('*').order('sort_order', { ascending: true });
    if (user.tenant_id) query = query.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data: data || [], defaults: DEFAULT_DEPARTMENTS });
  } catch (error) {
    console.error('get departments failed:', error);
    return jsonError('获取部门失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageOrganization(user)) return jsonError('无权创建部门', 403);

    const body = (await request.json()) as Record<string, unknown>;
    const name = text(body.name);
    const code = text(body.code);
    if (!name || !code) return jsonError('部门名称和编码不能为空', 400);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('departments')
      .insert({
        name,
        code,
        parent_id: text(body.parent_id),
        sort_order: Number(body.sort_order || 0),
        status: text(body.status) || 'active',
        remark: text(body.remark),
        tenant_id: user.tenant_id || null,
      })
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create department failed:', error);
    return jsonError('创建部门失败', 500);
  }
}
