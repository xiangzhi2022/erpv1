import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { DEFAULT_ROLES, defaultPermissionsForRole } from '@/lib/organization';
import {
  canAccessPath,
  canAssignPermissionKeys,
  getAssignablePermissionKeys,
  getRoleManagementBusinessType,
  getUserPermissionKeys,
  isAdminRole,
  isSuperAdmin,
  type AccessUser,
  type PermissionKey,
} from '@/lib/role-access';

interface RoleRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  tenant_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  permission_codes?: PermissionKey[];
}

interface RolePermissionRow {
  role_id: string;
  permission?: { code?: string | null } | null;
}

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function canManageOrganization(user: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>): boolean {
  return isAdminRole(user) || getUserPermissionKeys(user).includes('factory_boss');
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function roleScopeLabel(user: AccessUser) {
  if (isSuperAdmin(user)) return '超级管理员可管理全部企业角色权限。';
  const businessType = getRoleManagementBusinessType(user);
  const businessLabel = businessType === 'factory' ? '工厂' : businessType === 'dealer' ? '经销商' : '材料供应商';
  return `${businessLabel}管理员只能管理本企业的${businessLabel}角色和权限。`;
}

function defaultRolesForUser(user: AccessUser): RoleRow[] {
  const allowed = new Set(getAssignablePermissionKeys(user));
  const roles = isSuperAdmin(user)
    ? DEFAULT_ROLES
    : DEFAULT_ROLES.filter((role) => {
        const permissions = defaultPermissionsForRole(role.code);
        return permissions.length > 0 && permissions.every((permission) => allowed.has(permission));
      });

  return roles.map((role) => ({
    id: role.code,
    code: role.code,
    name: role.name,
    description: role.description,
    status: 'active',
    tenant_id: isSuperAdmin(user) ? null : user.tenant_id || null,
    permission_codes: defaultPermissionsForRole(role.code),
  }));
}

async function loadRolePermissionMap(roleIds: string[]): Promise<Map<string, PermissionKey[]>> {
  const map = new Map<string, PermissionKey[]>();
  if (roleIds.length === 0) return map;

  const { data } = await getSupabaseClient()
    .from('role_permissions')
    .select('role_id, permission:permissions(code)')
    .in('role_id', roleIds);

  for (const row of (data || []) as RolePermissionRow[]) {
    const code = row.permission?.code;
    if (!code) continue;
    const values = map.get(row.role_id) || [];
    values.push(code as PermissionKey);
    map.set(row.role_id, values);
  }
  return map;
}

function roleMatchesBusinessScope(user: AccessUser, role: RoleRow): boolean {
  if (isSuperAdmin(user)) return true;
  if (!user.tenant_id || role.tenant_id !== user.tenant_id) return false;
  const permissionCodes = role.permission_codes || defaultPermissionsForRole(role.code);
  if (permissionCodes.length === 0) return true;
  return canAssignPermissionKeys(user, permissionCodes);
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/settings/roles')) return jsonError('无权查看角色', 403);
    if (!isSuperAdmin(user) && !user.tenant_id) return jsonError('当前管理员未关联企业', 403);

    const supabase = getSupabaseClient();
    let query = supabase.from('roles').select('*').order('created_at', { ascending: false });
    if (!isSuperAdmin(user)) query = query.eq('tenant_id', user.tenant_id);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);

    const permissionMap = await loadRolePermissionMap(((data || []) as RoleRow[]).map((role) => role.id));
    const rows = ((data || []) as RoleRow[])
      .map((role) => ({
        ...role,
        permission_codes: permissionMap.get(role.id) || defaultPermissionsForRole(role.code),
      }))
      .filter((role) => roleMatchesBusinessScope(user, role));

    return Response.json({
      success: true,
      data: rows.length > 0 ? rows : defaultRolesForUser(user),
      defaults: defaultRolesForUser(user),
      scope: {
        is_super_admin: isSuperAdmin(user),
        tenant_id: user.tenant_id || null,
        business_type: getRoleManagementBusinessType(user) || 'platform',
        message: roleScopeLabel(user),
      },
    });
  } catch (error) {
    console.error('get roles failed:', error);
    return jsonError('获取角色失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageOrganization(user)) return jsonError('无权创建角色', 403);
    const body = (await request.json()) as Record<string, unknown>;
    const name = text(body.name);
    const code = text(body.code);
    if (!name || !code) return jsonError('角色名称和编码不能为空', 400);
    if (!isSuperAdmin(user) && !user.tenant_id) return jsonError('当前管理员未关联企业', 403);
    const defaultPermissions = defaultPermissionsForRole(code);
    if (!isSuperAdmin(user) && defaultPermissions.length > 0 && !canAssignPermissionKeys(user, defaultPermissions)) {
      return jsonError('不能创建其他企业类型的角色', 403);
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('roles')
      .insert({
        name,
        code,
        description: text(body.description),
        status: text(body.status) || 'active',
        tenant_id: isSuperAdmin(user) ? text(body.tenant_id) : user.tenant_id || null,
      })
      .select()
      .single();
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create role failed:', error);
    return jsonError('创建角色失败', 500);
  }
}
