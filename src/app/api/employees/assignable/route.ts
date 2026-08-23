import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

const ASSIGNABLE_EMPLOYEE_COLUMNS = 'id,enterprise_id,user_id,employee_no,name,phone,email,avatar_url,department_id,primary_position_id,employee_type,status,hire_date,leave_date,remark,created_at,updated_at,department:departments(id,name,code),primary_position:positions(id,name,code,position_type,can_receive_production_task,can_calculate_piece_wage,can_review_task,can_assign_task)';

export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const processName = (searchParams.get('processName') || '').toLowerCase();
    const employeeQuery = supabase
      .from('employees')
      .select(ASSIGNABLE_EMPLOYEE_COLUMNS)
      .eq('enterprise_id', context.enterpriseId)
      .eq('status', 'active')
      .order('employee_no', { ascending: true });

    const { data: employees, error } = await employeeQuery;
    if (error) return jsonError('获取可分配员工失败', 500);
    const salaryRes = hasEnterprisePermission(context, 'wages.read.all')
      ? await supabase.rpc('wages_read_employee_base_salaries', { target_enterprise_id: context.enterpriseId })
      : { data: [], error: null };
    if (salaryRes.error) return jsonError('获取员工薪资失败', 500);
    const salaryRows = Array.isArray(salaryRes.data)
      ? salaryRes.data as unknown as Array<{ id: string; base_salary: number }>
      : [];
    const salaries = new Map(salaryRows.map((row) => [row.id, row.base_salary]));
    const rows: Record<string, unknown>[] = ((employees || []) as unknown as Record<string, unknown>[]).map((employee): Record<string, unknown> => ({
      ...employee,
      ...(salaries.has(String(employee.id)) ? { base_salary: salaries.get(String(employee.id)) } : {}),
    }));
    const positionIds = rows.map((row) => String(row.primary_position_id || '')).filter(Boolean);
    const positionsRes = positionIds.length
      ? await supabase.from('positions').select('*').eq('enterprise_id', context.enterpriseId).in('id', positionIds)
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
