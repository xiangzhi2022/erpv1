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

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/employees')) return jsonError('无权查看员工', 403);

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get('keyword') || '').trim();
    const status = searchParams.get('status');
    let query = supabase
      .from('employees')
      .select('*, department:departments(id,name,code), primary_position:positions(id,name,code,position_type,can_receive_production_task,can_calculate_piece_wage,can_review_task,can_assign_task)')
      .order('created_at', { ascending: false });
    if (user.tenant_id) query = query.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);
    if (status && status !== 'all') query = query.eq('status', status);
    if (keyword) query = query.or(`name.ilike.%${keyword}%,employee_no.ilike.%${keyword}%,phone.ilike.%${keyword}%`);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data: data || [] });
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

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('employees')
      .insert({
        user_id: text(body.user_id),
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
    if (positionIds.length > 0) {
      await supabase.from('employee_positions').insert(positionIds.map((positionId) => ({
        employee_id: employeeId,
        position_id: positionId,
        is_primary: positionId === primaryPositionId,
      })));
    }
    if (roleIds.length > 0) {
      await supabase.from('employee_roles').insert(roleIds.map((roleId) => ({ employee_id: employeeId, role_id: roleId })));
    }
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create employee failed:', error);
    return jsonError('创建员工失败', 500);
  }
}
