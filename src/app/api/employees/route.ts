import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  createOrReuseEmployeeLoginUser,
  replaceEmployeeRelations,
  stringArray,
  syncEmployeeUserPermissions,
  text,
} from '@/lib/employee-management';
import { canAccessPath, getUserPermissionKeys, isAdminRole } from '@/lib/role-access';

type AuthUser = NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>;

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function canManageOrganization(user: AuthUser): boolean {
  return isAdminRole(user) || getUserPermissionKeys(user).includes('factory_boss');
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/employees')) return jsonError('无权查看员工', 403);

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get('keyword') || '').trim();
    const status = searchParams.get('status');
    const departmentId = searchParams.get('department_id');
    const positionId = searchParams.get('position_id');
    let query = supabase
      .from('employees')
      .select('*, department:departments(id,name,code), primary_position:positions(id,name,code,position_type,can_receive_production_task,can_calculate_piece_wage,can_review_task,can_assign_task), user:users(id,phone,real_name,is_active)')
      .order('created_at', { ascending: false });
    if (user.tenant_id) query = query.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);
    if (status && status !== 'all') query = query.eq('status', status);
    if (departmentId && departmentId !== 'all') query = query.eq('department_id', departmentId);
    if (positionId && positionId !== 'all') query = query.eq('primary_position_id', positionId);
    if (keyword) query = query.or(`name.ilike.%${keyword}%,employee_no.ilike.%${keyword}%,phone.ilike.%${keyword}%`);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);

    const rows = data || [];
    const employeeIds = rows.map((row) => row.id).filter(Boolean);
    const [positionsRes, rolesRes] = await Promise.all([
      employeeIds.length
        ? supabase.from('employee_positions').select('employee_id, position:positions(id,name,code)').in('employee_id', employeeIds)
        : Promise.resolve({ data: [] }),
      employeeIds.length
        ? supabase.from('employee_roles').select('employee_id, role:roles(id,name,code)').in('employee_id', employeeIds)
        : Promise.resolve({ data: [] }),
    ]);

    const positionsByEmployee = new Map<string, unknown[]>();
    for (const row of (positionsRes.data || []) as Array<{ employee_id: string }>) {
      positionsByEmployee.set(row.employee_id, [...(positionsByEmployee.get(row.employee_id) || []), row]);
    }
    const rolesByEmployee = new Map<string, unknown[]>();
    for (const row of (rolesRes.data || []) as Array<{ employee_id: string }>) {
      rolesByEmployee.set(row.employee_id, [...(rolesByEmployee.get(row.employee_id) || []), row]);
    }

    return Response.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        positions: positionsByEmployee.get(row.id) || [],
        roles: rolesByEmployee.get(row.id) || [],
      })),
    });
  } catch (error) {
    console.error('get employees failed:', error);
    return jsonError('获取员工失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageOrganization(user)) return jsonError('无权创建员工', 403);

    const body = (await request.json()) as Record<string, unknown>;
    const name = text(body.name);
    const employeeNo = text(body.employee_no);
    if (!name || !employeeNo) return jsonError('员工姓名和工号不能为空', 400);
    const positionIds = stringArray(body.position_ids);
    const roleIds = stringArray(body.role_ids);
    const primaryPositionId = text(body.primary_position_id) || positionIds[0] || null;
    const userId = await createOrReuseEmployeeLoginUser(body, user);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('employees')
      .insert({
        user_id: userId,
        employee_no: employeeNo,
        name,
        phone: text(body.phone),
        email: text(body.email),
        avatar_url: text(body.avatar_url),
        department_id: text(body.department_id),
        primary_position_id: primaryPositionId,
        employee_type: text(body.employee_type) || 'full_time',
        status: text(body.status) || 'active',
        hire_date: text(body.hire_date),
        leave_date: text(body.leave_date),
        base_salary: body.base_salary ?? 0,
        tenant_id: user.tenant_id || null,
        remark: text(body.remark),
      })
      .select()
      .single();
    if (error) return jsonError(error.message, 500);

    const employeeId = String(data.id);
    const roles = await replaceEmployeeRelations(employeeId, roleIds, positionIds, primaryPositionId, user);
    await syncEmployeeUserPermissions(userId, user.tenant_id || null, roles, user.id);

    return Response.json({ success: true, data: { ...data, role_ids: roles.map((role) => role.id) } });
  } catch (error) {
    console.error('create employee failed:', error);
    return jsonError(error instanceof Error ? error.message : '创建员工失败', 500);
  }
}
