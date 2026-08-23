import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';
import {
  createOrReuseEmployeeLoginUser,
  EmployeeIdentityConflict,
  ensureEmployeeRoleRows,
  stringArray,
  text,
  type EmployeeRoleRow,
} from '@/lib/employee-management';

const EMPLOYEE_DETAIL_COLUMNS = 'id,enterprise_id,user_id,employee_no,name,phone,email,avatar_url,department_id,primary_position_id,employee_type,status,hire_date,leave_date,remark,created_at,updated_at,department:departments(id,name,code),primary_position:positions(id,name,code,position_type,can_receive_production_task,can_calculate_piece_wage,can_review_task,can_assign_task)';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    void request;
    const context = await getEnterpriseContext();
    requirePermission(context, 'members.read');
    const { id } = await params;
    const supabase = await createClient();
    const query = supabase
      .from('employees')
      .select(EMPLOYEE_DETAIL_COLUMNS)
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id);
    const employeeRes = await query.maybeSingle();
    if (employeeRes.error) return jsonError('获取员工失败', 500);
    if (!employeeRes.data) return jsonError('员工不存在', 404);
    const salaryRes = hasEnterprisePermission(context, 'wages.read.all')
      ? await supabase.rpc('wages_read_employee_base_salaries', { target_enterprise_id: context.enterpriseId })
      : { data: [], error: null };
    if (salaryRes.error) return jsonError('获取员工薪资失败', 500);
    const salaryRows = Array.isArray(salaryRes.data)
      ? salaryRes.data as unknown as Array<{ id: string; base_salary: number }>
      : [];
    const salary = salaryRows.find((row) => row.id === id);
    const [positionsRes, rolesRes] = await Promise.all([
      supabase.from('employee_positions').select('*, position:positions(*)').eq('enterprise_id', context.enterpriseId).eq('employee_id', id),
      supabase.from('employee_roles').select('*, role:roles(*)').eq('enterprise_id', context.enterpriseId).eq('employee_id', id),
    ]);
    return Response.json({
      success: true,
      data: {
        ...employeeRes.data,
        ...(salary ? { base_salary: salary.base_salary } : {}),
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
    const context = await getEnterpriseContext();
    requirePermission(context, 'members.manage');
    const { id } = await params;
    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const updateData: Record<string, string | number | null> = {};

    for (const key of ['employee_no', 'name', 'phone', 'email', 'avatar_url', 'employee_type', 'status', 'hire_date', 'leave_date', 'base_salary', 'remark']) {
      const value = body[key];
      if (value === null || typeof value === 'string' || typeof value === 'number') {
        updateData[key] = value;
      }
    }
    if (updateData.status === 'resigned') updateData.status = 'departed';
    if (updateData.status === 'probation') updateData.status = 'active';
    if (body.department_id !== undefined) updateData.department_id = text(body.department_id);

    const supabase = await createClient();
    const [{ data: existing, error: existingError }, positionsResult, rolesResult] = await Promise.all([
      supabase.from('employees').select('id,user_id,primary_position_id,status').eq('enterprise_id', context.enterpriseId).eq('id', id).maybeSingle(),
      supabase.from('employee_positions').select('position_id').eq('enterprise_id', context.enterpriseId).eq('employee_id', id),
      supabase.from('employee_roles').select('role:roles(id,code,name,description,tenant_id)').eq('enterprise_id', context.enterpriseId).eq('employee_id', id),
    ]);
    if (existingError) return jsonError('修改员工失败', 500);
    if (!existing) return jsonError('员工不存在', 404);
    if (positionsResult.error || rolesResult.error) return jsonError('读取员工关系失败', 500);
    const userId = body.user_id !== undefined
      ? await createOrReuseEmployeeLoginUser({ user_id: body.user_id }, context)
      : existing.user_id;
    const positionIds = body.position_ids !== undefined
      ? stringArray(body.position_ids)
      : ((positionsResult.data || []) as Array<{ position_id: string }>).map((row) => row.position_id);
    const requestedRoleIds = body.role_ids !== undefined
      ? stringArray(body.role_ids)
      : ((rolesResult.data || []) as unknown as Array<{ role?: EmployeeRoleRow | EmployeeRoleRow[] | null }>)
          .map((row) => (Array.isArray(row.role) ? row.role[0]?.id : row.role?.id))
          .filter((value): value is string => Boolean(value));
    const roles = await ensureEmployeeRoleRows(requestedRoleIds, context);
    const primaryPositionId = body.primary_position_id !== undefined
      ? text(body.primary_position_id)
      : existing.primary_position_id;
    const { data, error } = await supabase.rpc('save_employee_with_relations', {
      target_employee_id: id,
      target_enterprise_id: context.enterpriseId,
      target_fields: updateData,
      target_position_ids: positionIds,
      target_primary_position_id: primaryPositionId,
      target_role_ids: roles.map((role) => role.id),
      target_user_id: userId,
    });
    if (error?.message === 'permission_denied') return jsonError('没有修改员工或分配角色的权限', 403);
    if (error?.message === 'wage_permission_denied') return jsonError('没有修改员工底薪的权限', 403);
    if (error?.message === 'active_member_not_found') return jsonError('登录账号尚未通过当前企业加入审批', 409);
    if (error?.message === 'role_not_assignable' || error?.message === 'owner_protected') return jsonError('不能修改所有者或分配超出当前账号权限范围的角色', 403);
    if (error?.message === 'last_owner_required') return jsonError('企业必须保留至少一名启用的所有者', 409);
    if (error) return jsonError('修改员工失败', 500);
    const responseData = data && typeof data === 'object' && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>) }
      : data;
    if (responseData && typeof responseData === 'object'
      && !hasEnterprisePermission(context, 'wages.read.all')) {
      delete (responseData as Record<string, unknown>).base_salary;
    }
    return Response.json({ success: true, data: responseData });
  } catch (error) {
    console.error('update employee failed:', error);
    if (error instanceof EmployeeIdentityConflict) return jsonError(error.message, error.status);
    return jsonError('修改员工失败', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'members.manage');
    const { id } = await params;
    const hard = new URL(request.url).searchParams.get('hard') === '1';
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('delete_employee_with_access', {
      target_employee_id: id,
      target_enterprise_id: context.enterpriseId,
      target_hard_delete: hard,
    });
    if (error?.message === 'employee_not_found') return jsonError('员工不存在', 404);
    if (error?.message === 'cannot_deactivate_self') return jsonError('不能停用当前登录账号', 409);
    if (error?.message === 'permission_denied') return jsonError('没有停用或删除员工的权限', 403);
    if (error?.message === 'owner_protected') return jsonError('只有企业所有者可以停用或删除所有者档案', 403);
    if (error?.message === 'last_owner_required') return jsonError('企业必须保留至少一名启用的所有者', 409);
    if (error) return jsonError(hard ? '删除员工失败' : '停用员工失败', 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('delete employee failed:', error);
    return jsonError('删除员工失败', 500);
  }
}
