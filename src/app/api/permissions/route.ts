import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  PERMISSION_TEMPLATES,
  canAccessPath,
  getAssignablePermissionKeys,
  getRoleManagementBusinessType,
  isSuperAdmin,
} from '@/lib/role-access';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

interface PermissionRow {
  id: string;
  code: string;
  name: string;
  module?: string;
  permission_type?: string;
  description?: string | null;
}

function mergePermissionRows(rows: PermissionRow[] | null | undefined, fallbackRows: PermissionRow[]): PermissionRow[] {
  const map = new Map<string, PermissionRow>();
  for (const row of fallbackRows) map.set(row.code, row);
  for (const row of rows || []) map.set(row.code, row);
  return Array.from(map.values());
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/settings/roles')) return jsonError('无权查看权限', 403);
    if (!isSuperAdmin(user) && !user.tenant_id) return jsonError('当前管理员未关联企业', 403);

    const allowedCodes = new Set(getAssignablePermissionKeys(user));
    const templateRows = PERMISSION_TEMPLATES
      .filter((permission) => isSuperAdmin(user) || allowedCodes.has(permission.key))
      .map((permission) => ({
        id: permission.key,
        code: permission.key,
        name: permission.label,
        module: permission.businessType,
        permission_type: 'route',
        description: permission.description,
      }));
    const scope = {
      is_super_admin: isSuperAdmin(user),
      tenant_id: user.tenant_id || null,
      business_type: getRoleManagementBusinessType(user) || 'platform',
    };
    if (!isSuperAdmin(user) && allowedCodes.size === 0) {
      return Response.json({ success: true, data: templateRows, scope });
    }

    const supabase = getSupabaseClient();
    let query = supabase.from('permissions').select('*').order('module', { ascending: true });
    if (!isSuperAdmin(user)) query = query.in('code', Array.from(allowedCodes));
    const { data, error } = await query;
    if (error) {
      return Response.json({
        success: true,
        data: templateRows,
        warning: error.message,
        scope,
      });
    }
    const rows = mergePermissionRows((data || []) as PermissionRow[], templateRows);
    return Response.json({
      success: true,
      data: rows,
      scope,
    });
  } catch (error) {
    console.error('get permissions failed:', error);
    return jsonError('获取权限失败', 500);
  }
}
