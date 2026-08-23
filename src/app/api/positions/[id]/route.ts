import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'organization.manage');

    const { id } = await params;
    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'name',
      'code',
      'department_id',
      'position_type',
      'can_receive_production_task',
      'can_calculate_piece_wage',
      'can_review_task',
      'can_assign_task',
      'default_role_code',
      'status',
      'remark',
    ]) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }
    const supabase = await createClient();
    const query = supabase.from('positions').update(updateData).eq('enterprise_id', context.enterpriseId).eq('id', id);
    const { data, error } = await query.select().single();
    if (error) return jsonError('修改岗位失败', 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update position failed:', error);
    return jsonError('修改岗位失败', 500);
  }
}
