import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageProduction } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageProduction(user)) return jsonError('无权查看可分配员工', 403);

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const processName = (searchParams.get('processName') || '').toLowerCase();
    let employeeQuery = supabase
      .from('employees')
      .select('*, department:departments(id,name,code), primary_position:positions(*)')
      .eq('status', 'active')
      .order('employee_no', { ascending: true });
    if (user.tenant_id) employeeQuery = employeeQuery.or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`);

    const { data: employees, error } = await employeeQuery;
    if (error) return jsonError(error.message, 500);
    const rows = (employees || []) as Record<string, unknown>[];
    const positionIds = rows.map((row) => String(row.primary_position_id || '')).filter(Boolean);
    const positionsRes = positionIds.length
      ? await supabase.from('positions').select('*').in('id', positionIds)
      : { data: [] };
    const positionMap = new Map(((positionsRes.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), row]));
    const assignable = rows
      .map((employee) => {
        const position = (employee.primary_position as Record<string, unknown> | null) || positionMap.get(String(employee.primary_position_id || '')) || null;
        return { ...employee, primary_position: position };
      })
      .filter((employee) => {
        const position = employee.primary_position as Record<string, unknown> | null;
        if (position?.can_receive_production_task !== true) return false;
        if (!processName) return true;
        return [position.code, position.name, position.position_type, (employee as Record<string, unknown>).name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(processName);
      });

    return Response.json({ success: true, data: assignable });
  } catch (error) {
    console.error('get assignable employees failed:', error);
    return jsonError('获取可分配员工失败', 500);
  }
}
