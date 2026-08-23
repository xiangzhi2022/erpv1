import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_DEPARTMENTS } from '@/lib/organization';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(request: Request) {
  try {
    void request;
    const context = await getEnterpriseContext();
    requirePermission(context, 'organization.read');
    const supabase = await createClient();
    const query = supabase.from('departments').select('*').eq('enterprise_id', context.enterpriseId).order('sort_order', { ascending: true });
    const { data, error } = await query;
    if (error) return jsonError('获取部门失败', 500);
    return Response.json({ success: true, data: data || [], defaults: DEFAULT_DEPARTMENTS });
  } catch (error) {
    console.error('get departments failed:', error);
    return jsonError('获取部门失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'organization.manage');

    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const name = text(body.name);
    const code = text(body.code);
    if (!name || !code) return jsonError('部门名称和编码不能为空', 400);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('departments')
      .insert({
        name,
        code,
        parent_id: text(body.parent_id),
        sort_order: Number(body.sort_order || 0),
        status: text(body.status) || 'active',
        remark: text(body.remark),
        enterprise_id: context.enterpriseId,
      })
      .select()
      .single();
    if (error) return jsonError('创建部门失败', 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create department failed:', error);
    return jsonError('创建部门失败', 500);
  }
}
