import { z } from 'zod';
import type { Database } from '@/db/database.types';
import { allowNullableRpcArgs } from '@/db/rpc-args';
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
    const { data, error } = await client.rpc('update_enterprise_role', allowNullableRpcArgs<
      'update_enterprise_role',
      'target_code' | 'target_description' | 'target_name'
    >({
      target_enterprise_id: context.enterpriseId,
      target_role_id: id,
      target_code: body.code ?? null,
      target_name: body.name ?? null,
      target_description: body.description ?? null,
      update_code: 'code' in body,
      update_name: 'name' in body,
      update_description: 'description' in body,
    }));
    if (error?.message === 'role_not_found') return jsonError('角色不存在', 404);
    if (error?.message === 'system_role_code_protected') return jsonError('系统角色编码不可修改', 409);
    if (error?.message === 'system_role_code_reserved') return jsonError('该编码保留给系统角色', 409);
    if (error?.message === 'owner_protected') return jsonError('只有企业所有者可以修改所有者角色', 403);
    if (error?.message === 'permission_denied') return jsonError('没有修改角色的权限', 403);
    if (error?.code === '23505') return jsonError('角色编码已存在', 409);
    if (error || !data) return jsonError('修改角色失败', 500);
    const role = data as Database['public']['Tables']['roles']['Row'];
    return Response.json({ success: true, data: { ...role, status: 'active' } });
  } catch (error) {
    console.error('update enterprise role failed:', error);
    return jsonError('修改角色失败', 500);
  }
}
