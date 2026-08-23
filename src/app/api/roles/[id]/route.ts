import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  code: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_.-]*$/).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'roles.manage');
    const { id } = await params;
    const body = await parseJson(request, updateRoleSchema);
    if (Object.keys(body).length === 0) return jsonError('没有可更新的角色信息', 400);
    const client = await createClient();
    const { data: existing, error: existingError } = await client
      .from('roles')
      .select('id,is_system')
      .eq('tenant_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (existingError || !existing) return jsonError('角色不存在', 404);
    if (existing.is_system && body.code) return jsonError('系统角色编码不可修改', 409);
    const { data, error } = await client
      .from('roles')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('tenant_id', context.enterpriseId)
      .eq('id', id)
      .select('id,name,code,description,is_system,tenant_id,created_at,updated_at')
      .maybeSingle();
    if (error || !data) return jsonError('修改角色失败', 500);
    return Response.json({ success: true, data: { ...data, status: 'active' } });
  } catch (error) {
    console.error('update enterprise role failed:', error);
    return jsonError('修改角色失败', 500);
  }
}
