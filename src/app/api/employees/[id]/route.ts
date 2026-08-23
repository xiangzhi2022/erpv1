import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';
import {
  replaceEmployeeRelations,
  stringArray,
  syncEmployeeRoleBindings,
  text,
  type EmployeeRoleRow,
} from '@/lib/employee-management';

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
      .select('*, department:departments(*), primary_position:positions(*)')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id);
    const employeeRes = await query.maybeSingle();
    if (employeeRes.error) return jsonError('获取员工失败', 500);
    if (!employeeRes.data) return jsonError('员工不存在', 404);
    const [positionsRes, rolesRes] = await Promise.all([
      supabase.from('employee_positions').select('*, position:positions(*)').eq('enterprise_id', context.enterpriseId).eq('employee_id', id),
      supabase.from('employee_roles').select('*, role:roles(*)').eq('enterprise_id', context.enterpriseId).eq('employee_id', id),
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
    const context = await getEnterpriseContext();
    requirePermission(context, 'members.manage');
    const { id } = await params;
    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const key of ['employee_no', 'name', 'phone', 'email', 'avatar_url', 'employee_type', 'status', 'hire_date', 'leave_date', 'base_salary', 'remark']) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }
    if (body.user_id !== undefined) updateData.user_id = text(body.user_id);
    if (body.department_id !== undefined) updateData.department_id = text(body.department_id);
    if (body.primary_position_id !== undefined) updateData.primary_position_id = text(body.primary_position_id);

    const supabase = await createClient();
    const query = supabase.from('employees').update(updateData).eq('enterprise_id', context.enterpriseId).eq('id', id);
    const { data, error } = await query.select().single();
    if (error) return jsonError('修改员工失败', 500);

    let syncedRoles: EmployeeRoleRow[] | null = null;
    if (body.position_ids !== undefined || body.role_ids !== undefined) {
      const existingPositions = body.position_ids === undefined
        ? await supabase.from('employee_positions').select('position_id').eq('enterprise_id', context.enterpriseId).eq('employee_id', id)
        : null;
      const existingRoles = body.role_ids === undefined
        ? await supabase.from('employee_roles').select('role:roles(id,code,name,description,tenant_id)').eq('enterprise_id', context.enterpriseId).eq('employee_id', id)
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
      syncedRoles = await replaceEmployeeRelations(id, roleIds, positionIds, primaryPositionId, context);
    }

    if (body.user_id !== undefined || body.role_ids !== undefined) {
      const userId = text(body.user_id) || String(data.user_id || '') || null;
      if (syncedRoles) await syncEmployeeRoleBindings(userId, syncedRoles, context);
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update employee failed:', error);
    return jsonError(error instanceof Error ? error.message : '修改员工失败', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'members.manage');
    const { id } = await params;
    const hard = new URL(request.url).searchParams.get('hard') === '1';
    const supabase = await createClient();

    const existingQuery = supabase.from('employees').select('id,user_id,enterprise_id,status').eq('enterprise_id', context.enterpriseId).eq('id', id);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) return jsonError('删除员工失败', 500);
    if (!existing) return jsonError('员工不存在', 404);

    if (!hard) {
      const { error } = await supabase
        .from('employees')
        .update({ status: 'inactive', leave_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', id);
      if (error) return jsonError('停用员工失败', 500);
      return Response.json({ success: true, mode: 'inactive' });
    }

    await supabase.from('employee_positions').delete().eq('enterprise_id', context.enterpriseId).eq('employee_id', id);
    await supabase.from('employee_roles').delete().eq('enterprise_id', context.enterpriseId).eq('employee_id', id);
    const { error } = await supabase.from('employees').delete().eq('enterprise_id', context.enterpriseId).eq('id', id);
    if (error) return jsonError('删除员工失败', 500);
    return Response.json({ success: true, mode: 'deleted' });
  } catch (error) {
    console.error('delete employee failed:', error);
    return jsonError('删除员工失败', 500);
  }
}
