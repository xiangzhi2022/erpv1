import { parseJsonObject } from '@/lib/api/request';
import { allowNullableRpcArgs } from '@/db/rpc-args';
import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';
import {
  createOrReuseEmployeeLoginUser,
  EmployeeIdentityConflict,
  ensureEmployeeRoleRows,
  stringArray,
  text,
} from '@/lib/employee-management';

const EMPLOYEE_LIST_COLUMNS = 'id,enterprise_id,user_id,employee_no,name,phone,email,avatar_url,department_id,primary_position_id,employee_type,status,hire_date,leave_date,remark,created_at,updated_at,department:departments(id,name,code),primary_position:positions(id,name,code,position_type,can_receive_production_task,can_calculate_piece_wage,can_review_task,can_assign_task)';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'members.read');
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get('keyword') || '').trim();
    const status = searchParams.get('status');
    const departmentId = searchParams.get('department_id');
    const positionId = searchParams.get('position_id');
    let query = supabase
      .from('employees')
      .select(EMPLOYEE_LIST_COLUMNS)
      .eq('enterprise_id', context.enterpriseId)
      .order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    if (departmentId && departmentId !== 'all') query = query.eq('department_id', departmentId);
    if (positionId && positionId !== 'all') query = query.eq('primary_position_id', positionId);
    if (keyword) query = query.or(`name.ilike.%${keyword}%,employee_no.ilike.%${keyword}%,phone.ilike.%${keyword}%`);
    const { data, error } = await query;
    if (error) return jsonError('获取员工失败', 500);

    const salaryRes = hasEnterprisePermission(context, 'wages.read.all')
      ? await supabase.rpc('wages_read_employee_base_salaries', { target_enterprise_id: context.enterpriseId })
      : { data: [], error: null };
    if (salaryRes.error) return jsonError('获取员工薪资失败', 500);
    const salaryRows = Array.isArray(salaryRes.data)
      ? salaryRes.data as unknown as Array<{ id: string; base_salary: number }>
      : [];
    const salaries = new Map(salaryRows.map((row) => [row.id, row.base_salary]));
    const rows = (data || []).map((row) => ({
      ...row,
      ...(salaries.has(row.id) ? { base_salary: salaries.get(row.id) } : {}),
    }));
    const employeeIds = rows.map((row) => row.id).filter(Boolean);
    const [positionsRes, rolesRes] = await Promise.all([
      employeeIds.length
        ? supabase.from('employee_positions').select('employee_id, position:positions(id,name,code)').eq('enterprise_id', context.enterpriseId).in('employee_id', employeeIds)
        : Promise.resolve({ data: [] }),
      employeeIds.length
        ? supabase.from('employee_roles').select('employee_id, role:roles(id,name,code)').eq('enterprise_id', context.enterpriseId).in('employee_id', employeeIds)
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
    const context = await getEnterpriseContext();
    requirePermission(context, 'members.manage');

    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const name = text(body.name);
    const employeeNo = text(body.employee_no);
    if (!name || !employeeNo) return jsonError('员工姓名和工号不能为空', 400);
    const positionIds = stringArray(body.position_ids);
    const roleIds = stringArray(body.role_ids);
    const primaryPositionId = text(body.primary_position_id) || positionIds[0] || null;
    const userId = await createOrReuseEmployeeLoginUser(body, context);

    const supabase = await createClient();
    const roles = await ensureEmployeeRoleRows(roleIds, context);
    const { data, error } = await supabase.rpc('save_employee_with_relations', allowNullableRpcArgs<
      'save_employee_with_relations',
      'target_employee_id' | 'target_primary_position_id' | 'target_user_id'
    >({
      target_employee_id: null,
      target_enterprise_id: context.enterpriseId,
      target_fields: {
        employee_no: employeeNo,
        name,
        phone: text(body.phone),
        email: text(body.email),
        avatar_url: text(body.avatar_url),
        department_id: text(body.department_id),
        employee_type: text(body.employee_type) || 'full_time',
        status: text(body.status) === 'resigned'
          ? 'departed'
          : text(body.status) === 'probation' ? 'active' : text(body.status) || 'active',
        hire_date: text(body.hire_date),
        leave_date: text(body.leave_date),
        base_salary: typeof body.base_salary === 'number' ? body.base_salary : Number(body.base_salary || 0),
        remark: text(body.remark),
      },
      target_position_ids: positionIds,
      target_primary_position_id: primaryPositionId,
      target_role_ids: roles.map((role) => role.id),
      target_user_id: userId,
    }));
    if (error?.message === 'permission_denied') return jsonError('没有创建员工或分配角色的权限', 403);
    if (error?.message === 'wage_permission_denied') return jsonError('没有设置员工底薪的权限', 403);
    if (error?.message === 'role_not_assignable' || error?.message === 'owner_protected') return jsonError('不能分配超出当前账号权限范围的角色', 403);
    if (error) return jsonError('创建员工失败', 500);
    const responseData = data && typeof data === 'object' && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>) }
      : data;
    if (responseData && typeof responseData === 'object'
      && !hasEnterprisePermission(context, 'wages.read.all')) {
      delete (responseData as Record<string, unknown>).base_salary;
    }
    return Response.json({ success: true, data: responseData });
  } catch (error) {
    console.error('create employee failed:', error);
    if (error instanceof EmployeeIdentityConflict) return jsonError(error.message, error.status);
    return jsonError('创建员工失败', 500);
  }
}
