import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'organization.manage');

    const { id } = await params;
    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ['name', 'code', 'parent_id', 'sort_order', 'status', 'remark']) {
      if (body[key] !== undefined) updateData[key] = key === 'sort_order' ? Number(body[key] || 0) : body[key];
    }
    if (body.parent_id !== undefined) updateData.parent_id = text(body.parent_id);
    const supabase = await createClient();
    const query = supabase.from('departments').update(updateData).eq('enterprise_id', context.enterpriseId).eq('id', id);
    const { data, error } = await query.select().single();
    if (error) return jsonError('修改部门失败', 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update department failed:', error);
    return jsonError('修改部门失败', 500);
  }
}
