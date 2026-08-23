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
    const role = await enterpriseRole(id, context.enterpriseId);
    if (!role) return jsonError('角色不存在', 404);
    const body = await parseJson(request, permissionsSchema);
    const permissionCodes = Array.from(new Set(body.permission_codes));
    const client = await createClient();
    if (permissionCodes.length > 0) {
      const { data: catalog, error } = await client
        .from('permission_catalog')
        .select('code')
        .in('code', permissionCodes);
      if (error || (catalog ?? []).length !== permissionCodes.length) {
        return jsonError('包含无效权限编码', 400);
      }
    }
    const { error: clearError } = await client
      .from('role_permissions')
      .delete()
      .eq('tenant_id', context.enterpriseId)
      .eq('role_id', id);
    if (clearError) return jsonError('修改角色权限失败', 500);
    if (permissionCodes.length > 0) {
      const { error } = await client.from('role_permissions').insert(
        permissionCodes.map((permissionCode) => ({
          tenant_id: context.enterpriseId,
          role_id: id,
          permission_code: permissionCode,
        })),
      );
      if (error) return jsonError('修改角色权限失败', 500);
    }
    return Response.json({ success: true, data: permissionCodes });
  } catch (error) {
    console.error('update enterprise role permissions failed:', error);
    return jsonError('修改角色权限失败', 500);
  }
}
