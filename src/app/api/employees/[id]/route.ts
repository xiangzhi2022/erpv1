import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  replaceEmployeeRelations,
  stringArray,
  syncEmployeeUserPermissions,
  text,
  type EmployeeRoleRow,
} from '@/lib/employee-management';
import { canAccessPath, getUserPermissionKeys, isAdminRole } from '@/lib/role-access';

type AuthUser = NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>;

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function canManageOrganization(user: AuthUser): boolean {
  return isAdminRole(user) || getUserPermissionKeys(user).includes('factory_boss');
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/employees')) return jsonError('无权查看员工', 403);
    const { id } = await params;
    const supabase = getSupabaseClient();
    let query = supabase
      .from('employees')
      .select('*, department:departments(*), primary_position:positions(*)')
      .eq('id', id);
    if (user.tenant_id) query = query.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);
    const employeeRes = await query.maybeSingle();
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

    for (const key of ['employee_no', 'name', 'phone', 'email', 'avatar_url', 'employee_type', 'status', 'hire_date', 'leave_date', 'base_salary', 'remark']) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }
    if (body.user_id !== undefined) updateData.user_id = text(body.user_id);
    if (body.department_id !== undefined) updateData.department_id = text(body.department_id);
    if (body.primary_position_id !== undefined) updateData.primary_position_id = text(body.primary_position_id);

    const supabase = getSupabaseClient();
    let query = supabase.from('employees').update(updateData).eq('id', id);
    if (user.tenant_id) query = query.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);
    const { data, error } = await query.select().single();
    if (error) return jsonError(error.message, 500);

    let syncedRoles: EmployeeRoleRow[] | null = null;
    if (body.position_ids !== undefined || body.role_ids !== undefined) {
      const existingPositions = body.position_ids === undefined
        ? await supabase.from('employee_positions').select('position_id').eq('employee_id', id)
        : null;
      const existingRoles = body.role_ids === undefined
        ? await supabase.from('employee_roles').select('role:roles(id,code,name,description,tenant_id)').eq('employee_id', id)
        : null;
      const positionIds = body.position_ids !== undefined
        ? stringArray(body.position_ids)
        : ((existingPositions?.data || []) as Array<{ position_id: string }>).map((row) => row.position_id);
      const roleIds = body.role_ids !== undefined
        ? stringArray(body.role_ids)
        : ((existingRoles?.data || []) as unknown as Array<{ role?: EmployeeRoleRow | EmployeeRoleRow[] | null }>)
            .map((row) => (Array.isArray(row.role) ? row.role[0]?.id : row.role?.id))
            .filter((value): value is string => Boolean(value));
      const primaryPositionId = text(body.primary_position_id) || String(data.primary_position_id || '') || positionIds[0] || null;
      syncedRoles = await replaceEmployeeRelations(id, roleIds, positionIds, primaryPositionId, user);
    }

    if (body.user_id !== undefined || body.role_ids !== undefined) {
      const userId = text(body.user_id) || String(data.user_id || '') || null;
      if (syncedRoles) await syncEmployeeUserPermissions(userId, user.tenant_id || null, syncedRoles, user.id);
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update employee failed:', error);
    return jsonError(error instanceof Error ? error.message : '修改员工失败', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageOrganization(user)) return jsonError('无权删除员工', 403);
    const { id } = await params;
    const hard = new URL(request.url).searchParams.get('hard') === '1';
    const supabase = getSupabaseClient();

    let existingQuery = supabase.from('employees').select('id,user_id,tenant_id,status').eq('id', id);
    if (user.tenant_id) existingQuery = existingQuery.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) return jsonError(existingError.message, 500);
    if (!existing) return jsonError('员工不存在', 404);

    if (!hard) {
      const { error } = await supabase
        .from('employees')
        .update({ status: 'inactive', leave_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return jsonError(error.message, 500);
      if (existing.user_id) {
        await supabase.from('users').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', existing.user_id);
      }
      return Response.json({ success: true, mode: 'inactive' });
    }

    await supabase.from('employee_positions').delete().eq('employee_id', id);
    await supabase.from('employee_roles').delete().eq('employee_id', id);
    if (existing.user_id) await supabase.from('user_permissions').delete().eq('user_id', existing.user_id);
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, mode: 'deleted' });
  } catch (error) {
    console.error('delete employee failed:', error);
    return jsonError('删除员工失败', 500);
  }
}
