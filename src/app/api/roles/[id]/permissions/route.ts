import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const permissionsSchema = z.object({
  permission_codes: z.array(z.string().trim().min(1)).max(200),
});

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

async function enterpriseRole(roleId: string, enterpriseId: string) {
  const client = await createClient();
  const { data, error } = await client
    .from('roles')
    .select('id,is_system')
    .eq('tenant_id', enterpriseId)
    .eq('id', roleId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'roles.manage');
    const { id } = await params;
    if (!await enterpriseRole(id, context.enterpriseId)) return jsonError('角色不存在', 404);
    const client = await createClient();
    const { data, error } = await client
      .from('role_permissions')
      .select('permission_code')
      .eq('tenant_id', context.enterpriseId)
      .eq('role_id', id)
      .order('permission_code', { ascending: true });
    if (error) return jsonError('获取角色权限失败', 500);
    return Response.json({ success: true, data: (data ?? []).map((row) => row.permission_code) });
  } catch (error) {
    console.error('get enterprise role permissions failed:', error);
    return jsonError('获取角色权限失败', 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'roles.manage');
    const { id } = await params;
    const body = await parseJson(request, permissionsSchema);
    const permissionCodes = Array.from(new Set(body.permission_codes));
    const client = await createClient();
    const { data, error } = await client.rpc('set_enterprise_role_permissions', {
      target_enterprise_id: context.enterpriseId,
      target_role_id: id,
      target_permission_codes: permissionCodes,
    });
    if (error?.message === 'role_not_found') return jsonError('角色不存在', 404);
    if (error?.message === 'invalid_permission_code') return jsonError('包含无效权限编码', 400);
    if (error?.message === 'permission_not_assignable') return jsonError('不能授予当前账号不拥有的权限', 403);
    if (error?.message === 'owner_protected') return jsonError('只有企业所有者可以修改所有者角色', 403);
    if (error?.message === 'owner_minimum_permissions_required') return jsonError('所有者角色必须保留角色和成员管理权限', 409);
    if (error?.message === 'permission_denied') return jsonError('没有修改角色权限的权限', 403);
    if (error || !data) return jsonError('修改角色权限失败', 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update enterprise role permissions failed:', error);
    return jsonError('修改角色权限失败', 500);
  }
}
