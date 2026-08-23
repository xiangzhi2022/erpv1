import { z } from 'zod';
import type { Database } from '@/db/database.types';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_.-]*$/),
  description: z.string().trim().max(500).nullable().optional(),
});

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'roles.manage');
    const client = await createClient();
    const { data: roles, error } = await client
      .from('roles')
      .select('id,name,code,description,is_system,tenant_id,created_at,updated_at')
      .eq('tenant_id', context.enterpriseId)
      .order('created_at', { ascending: true });
    if (error) return jsonError('获取角色失败', 500);
    const roleIds = (roles ?? []).map((role) => role.id);
    const { data: permissionRows } = roleIds.length
      ? await client
          .from('role_permissions')
          .select('role_id,permission_code')
          .eq('tenant_id', context.enterpriseId)
          .in('role_id', roleIds)
      : { data: [] };
    const permissionMap = new Map<string, string[]>();
    for (const row of permissionRows ?? []) {
      permissionMap.set(row.role_id, [...(permissionMap.get(row.role_id) ?? []), row.permission_code]);
    }
    const data = (roles ?? []).map((role) => ({
      ...role,
      status: 'active',
      permission_codes: permissionMap.get(role.id) ?? [],
    }));
    return Response.json({
      success: true,
      data,
      defaults: data.filter((role) => role.is_system),
      scope: {
        is_super_admin: false,
        tenant_id: context.enterpriseId,
        business_type: context.enterpriseType,
        message: '角色和权限仅在当前企业内生效。',
      },
    });
  } catch (error) {
    console.error('get enterprise roles failed:', error);
    return jsonError('获取角色失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'roles.manage');
    const body = await parseJson(request, createRoleSchema);
    const client = await createClient();
    const { data, error } = await client.rpc('create_enterprise_role', {
      target_enterprise_id: context.enterpriseId,
      target_code: body.code,
      target_name: body.name,
      target_description: body.description ?? null,
    });
    if (error?.message === 'permission_denied') return jsonError('没有创建角色的权限', 403);
    if (error?.message === 'system_role_code_reserved') return jsonError('该编码保留给系统角色', 409);
    if (error?.code === '23505') return jsonError('创建角色失败，角色编码可能已存在', 409);
    if (error || !data) return jsonError('创建角色失败', 500);
    const role = data as Database['public']['Tables']['roles']['Row'];
    return Response.json({ success: true, data: { ...role, status: 'active', permission_codes: [] } }, { status: 201 });
  } catch (error) {
    console.error('create enterprise role failed:', error);
    return jsonError('创建角色失败', 500);
  }
}
