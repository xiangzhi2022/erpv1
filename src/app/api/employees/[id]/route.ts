import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/employees')) return jsonError('无权查看员工', 403);
    const { id } = await params;
    const supabase = getSupabaseClient();
    const employeeRes = await supabase
      .from('employees')
      .select('*, department:departments(*), primary_position:positions(*)')
      .eq('id', id)
      .maybeSingle();
    if (employeeRes.error) return jsonError(employeeRes.error.message, 500);
    if (!employeeRes.data) return jsonError('员工不存在', 404);
    const [positionsRes, rolesRes] = await Promise.all([
      supabase.from('employee_positions').select('*, position:positions(*)').eq('employee_id', id),
      supabase.from('employee_roles').select('*, role:roles(*)').eq('employee_id', id),
    ]);
    return Response.json({
      success: true,
      data: {
        ...employeeRes.data,
        positions: positionsRes.data || [],
        roles: rolesRes.data || [],
      },
    });
  } catch (error) {
    console.error('get employee failed:', error);
    return jsonError('获取员工失败', 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageOrganization(user)) return jsonError('无权修改员工', 403);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'user_id',
      'employee_no',
      'name',
      'phone',
      'email',
      'avatar_url',
      'department_id',
      'primary_position_id',
      'employee_type',
      'status',
      'hire_date',
      'leave_date',
      'base_salary',
      'remark',
    ]) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }
    if (body.primary_position_id !== undefined) updateData.primary_position_id = text(body.primary_position_id);
    const supabase = getSupabaseClient();
    let query = supabase.from('employees').update(updateData).eq('id', id);
    if (user.tenant_id) query = query.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);
    const { data, error } = await query.select().single();
    if (error) return jsonError(error.message, 500);

    if (body.position_ids !== undefined) {
      const positionIds = stringArray(body.position_ids);
      await supabase.from('employee_positions').delete().eq('employee_id', id);
      if (positionIds.length > 0) {
        await supabase.from('employee_positions').insert(positionIds.map((positionId) => ({
          employee_id: id,
          position_id: positionId,
          is_primary: positionId === (text(body.primary_position_id) || String(data.primary_position_id || '')),
        })));
      }
    }
    if (body.role_ids !== undefined) {
      const roleIds = stringArray(body.role_ids);
      await supabase.from('employee_roles').delete().eq('employee_id', id);
      if (roleIds.length > 0) {
        await supabase.from('employee_roles').insert(roleIds.map((roleId) => ({ employee_id: id, role_id: roleId })));
      }
    }
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update employee failed:', error);
    return jsonError('修改员工失败', 500);
  }
}
