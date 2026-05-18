import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { getUserPermissionKeys, isAdminRole } from '@/lib/role-access';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function canManageOrganization(user: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>): boolean {
  return isAdminRole(user) || getUserPermissionKeys(user).includes('factory_boss');
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageOrganization(user)) return jsonError('无权修改岗位', 403);

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'name',
      'code',
      'department_id',
      'position_type',
      'can_receive_production_task',
      'can_calculate_piece_wage',
      'can_review_task',
      'can_assign_task',
      'default_role_code',
      'status',
      'remark',
    ]) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }
    const supabase = getSupabaseClient();
    let query = supabase.from('positions').update(updateData).eq('id', id);
    if (user.tenant_id) query = query.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);
    const { data, error } = await query.select().single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update position failed:', error);
    return jsonError('修改岗位失败', 500);
  }
}
