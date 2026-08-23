import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';
import {
  createOrReuseEmployeeLoginUser,
  replaceEmployeeRelations,
  stringArray,
  syncEmployeeRoleBindings,
  text,
} from '@/lib/employee-management';

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
      .select('*, department:departments(id,name,code), primary_position:positions(id,name,code,position_type,can_receive_production_task,can_calculate_piece_wage,can_review_task,can_assign_task)')
      .eq('enterprise_id', context.enterpriseId)
      .order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    if (departmentId && departmentId !== 'all') query = query.eq('department_id', departmentId);
    if (positionId && positionId !== 'all') query = query.eq('primary_position_id', positionId);
    if (keyword) query = query.or(`name.ilike.%${keyword}%,employee_no.ilike.%${keyword}%,phone.ilike.%${keyword}%`);
    const { data, error } = await query;
    if (error) return jsonError('获取员工失败', 500);

    const rows = data || [];
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
        base_salary: typeof body.base_salary === 'number' ? body.base_salary : Number(body.base_salary || 0),
        enterprise_id: context.enterpriseId,
        remark: text(body.remark),
      })
      .select()
      .single();
    if (error) return jsonError('创建员工失败', 500);

    const employeeId = String(data.id);
    const roles = await replaceEmployeeRelations(employeeId, roleIds, positionIds, primaryPositionId, context);
    await syncEmployeeRoleBindings(userId, roles, context);

    return Response.json({ success: true, data: { ...data, role_ids: roles.map((role) => role.id) } });
  } catch (error) {
    console.error('create employee failed:', error);
    return jsonError(error instanceof Error ? error.message : '创建员工失败', 500);
  }
}
