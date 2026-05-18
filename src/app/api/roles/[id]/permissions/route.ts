import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { DEFAULT_ROLES, defaultPermissionsForRole } from '@/lib/organization';
import {
  PERMISSION_TEMPLATES,
  canAccessPath,
  canAssignPermissionKeys,
  filterAssignablePermissionKeys,
  getPermissionTemplate,
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
}

interface PermissionRow {
  id: string;
  code: string;
}

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function canManageOrganization(user: NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>): boolean {
  return isAdminRole(user) || getUserPermissionKeys(user).includes('factory_boss');
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uniquePermissionKeys(value: string[]): PermissionKey[] {
  return Array.from(
    new Set(
      value.filter((code): code is PermissionKey => Boolean(getPermissionTemplate(code)))
    )
  );
}

function canManageRole(user: AccessUser, role: RoleRow): boolean {
  if (isSuperAdmin(user)) return true;
  if (!user.tenant_id || role.tenant_id !== user.tenant_id) return false;
  const defaultPermissions = defaultPermissionsForRole(role.code);
  return defaultPermissions.length === 0 || canAssignPermissionKeys(user, defaultPermissions);
}

async function resolveRole(id: string, user: AccessUser, createFromDefault: boolean): Promise<RoleRow | null> {
  const supabase = getSupabaseClient();
  const { data: role } = await supabase.from('roles').select('*').eq('id', id).maybeSingle();
  if (role) return role as RoleRow;

  const defaultRole = DEFAULT_ROLES.find((item) => item.code === id);
  if (!defaultRole) return null;

  const defaultPermissions = defaultPermissionsForRole(defaultRole.code);
  if (!isSuperAdmin(user) && !canAssignPermissionKeys(user, defaultPermissions)) return null;

  const tenantId = isSuperAdmin(user) ? null : user.tenant_id || null;
  if (!isSuperAdmin(user) && !tenantId) return null;

  let existingQuery = supabase.from('roles').select('*').eq('code', defaultRole.code);
  existingQuery = tenantId ? existingQuery.eq('tenant_id', tenantId) : existingQuery.is('tenant_id', null);
  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) return existing as RoleRow;
  if (!createFromDefault) {
    return {
      id: defaultRole.code,
      code: defaultRole.code,
      name: defaultRole.name,
      description: defaultRole.description,
      status: 'active',
      tenant_id: tenantId,
    };
  }

  const { data: created, error } = await supabase
    .from('roles')
    .insert({
      code: defaultRole.code,
      name: defaultRole.name,
      description: defaultRole.description,
      status: 'active',
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error || !created) throw error || new Error('create role failed');
  return created as RoleRow;
}

async function ensurePermissionRows(permissionCodes: PermissionKey[]): Promise<PermissionRow[]> {
  if (permissionCodes.length === 0) return [];

  const supabase = getSupabaseClient();
  const { data: existing, error } = await supabase
    .from('permissions')
    .select('id, code')
    .in('code', permissionCodes);
  if (error) throw error;

  const rows = ((existing || []) as PermissionRow[]).filter((row) => permissionCodes.includes(row.code as PermissionKey));
  const existingCodes = new Set(rows.map((row) => row.code));
  const missingCodes = permissionCodes.filter((code) => !existingCodes.has(code));

  if (missingCodes.length === 0) return rows;

  const inserts = missingCodes.map((code) => {
    const template = PERMISSION_TEMPLATES.find((permission) => permission.key === code);
    return {
      code,
      name: template?.label || code,
      module: template?.businessType || 'custom',
      permission_type: 'route',
      description: template?.description || null,
      tenant_id: null,
    };
  });

  const { data: created, error: createError } = await supabase
    .from('permissions')
    .insert(inserts)
    .select('id, code');
  if (createError) throw createError;

  return [...rows, ...((created || []) as PermissionRow[])];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canAccessPath(user, '/settings/roles')) return jsonError('无权查看角色权限', 403);
    const { id } = await params;
    const supabase = getSupabaseClient();
    const role = await resolveRole(id, user, false);
    if (!role) return jsonError('角色不存在或无权查看', 404);
    if (!canManageRole(user, role)) return jsonError('无权查看该角色权限', 403);
    const rows = isUuid(role.id)
      ? await supabase
          .from('role_permissions')
          .select('permission:permissions(code)')
          .eq('role_id', role.id)
      : { data: [] };
    const codes = ((rows.data || []) as Array<{ permission?: { code?: string } | null }>)
      .map((row) => row.permission?.code)
      .filter((code): code is string => Boolean(code));
    const permissionCodes = codes.length > 0 ? codes : defaultPermissionsForRole(role.code);
    const data = isSuperAdmin(user) ? uniquePermissionKeys(permissionCodes) : filterAssignablePermissionKeys(user, permissionCodes);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('get role permissions failed:', error);
    return jsonError('获取角色权限失败', 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageOrganization(user)) return jsonError('无权修改角色权限', 403);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const requestedPermissionCodes = uniquePermissionKeys(stringArray(body.permission_codes));
    if (!isSuperAdmin(user) && !canAssignPermissionKeys(user, requestedPermissionCodes)) {
      return jsonError('包含不可分配的权限', 403);
    }
    const permissionCodes = isSuperAdmin(user)
      ? requestedPermissionCodes
      : filterAssignablePermissionKeys(user, requestedPermissionCodes);
    const supabase = getSupabaseClient();
    const role = await resolveRole(id, user, true);
    if (!role) return jsonError('角色不存在或无权修改', 404);
    if (!canManageRole(user, role)) return jsonError('无权修改该角色权限', 403);

    const permissions = await ensurePermissionRows(permissionCodes);
    await supabase.from('role_permissions').delete().eq('role_id', role.id);
    const inserts = permissions.map((permission) => ({
      role_id: role.id,
      permission_id: permission.id,
    }));
    if (inserts.length > 0) {
      const { error } = await supabase.from('role_permissions').insert(inserts);
      if (error) return jsonError(error.message, 500);
    }
    return Response.json({ success: true, data: permissionCodes });
  } catch (error) {
    console.error('update role permissions failed:', error);
    return jsonError('修改角色权限失败', 500);
  }
}
