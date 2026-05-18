import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { defaultPermissionsForRole } from '@/lib/organization';
import {
  canAssignPermissionKeys,
  getUserPermissionKeys,
  isAdminRole,
  isSuperAdmin,
  type AccessUser,
} from '@/lib/role-access';

interface RoleRow {
  id: string;
  code: string;
  tenant_id: string | null;
}

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function canManageOrganization(user: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>): boolean {
  return isAdminRole(user) || getUserPermissionKeys(user).includes('factory_boss');
}

function canManageRole(user: AccessUser, role: RoleRow): boolean {
  if (isSuperAdmin(user)) return true;
  if (!user.tenant_id || role.tenant_id !== user.tenant_id) return false;
  const defaultPermissions = defaultPermissionsForRole(role.code);
  return defaultPermissions.length === 0 || canAssignPermissionKeys(user, defaultPermissions);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageOrganization(user)) return jsonError('无权修改角色', 403);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of ['name', 'code', 'description', 'status']) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }
    if (!isSuperAdmin(user) && updateData.code !== undefined) {
      const defaultPermissions = defaultPermissionsForRole(String(updateData.code));
      if (defaultPermissions.length > 0 && !canAssignPermissionKeys(user, defaultPermissions)) {
        return jsonError('不能改成其他企业类型的角色', 403);
      }
    }
    const supabase = getSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from('roles')
      .select('id, code, tenant_id')
      .eq('id', id)
      .maybeSingle();
    if (existingError || !existing) return jsonError('角色不存在', 404);
    if (!canManageRole(user, existing as RoleRow)) return jsonError('无权修改该角色', 403);

    const { data, error } = await supabase.from('roles').update(updateData).eq('id', id).select().single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update role failed:', error);
    return jsonError('修改角色失败', 500);
  }
}
