import { getSupabaseClient } from '@/db/client';
import { hashPassword, type AuthUser } from '@/lib/auth';
import { DEFAULT_ROLES, defaultPermissionsForRole } from '@/lib/organization';
import {
  canAssignPermissionKeys,
  isSuperAdmin,
  type PermissionKey,
} from '@/lib/role-access';

export interface EmployeeRoleRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  tenant_id?: string | null;
}

interface RolePermissionRow {
  role_id: string;
  permission?: { code?: string | null } | null;
}

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)))
    : [];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureEmployeeRoleRows(roleIdsOrCodes: string[], user: AuthUser): Promise<EmployeeRoleRow[]> {
  const supabase = getSupabaseClient();
  const ids = roleIdsOrCodes.filter(isUuid);
  const codes = roleIdsOrCodes.filter((value) => !isUuid(value));
  const rows: EmployeeRoleRow[] = [];

  if (ids.length > 0) {
    let query = supabase.from('roles').select('*').in('id', ids);
    if (!isSuperAdmin(user) && user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data || []) as EmployeeRoleRow[]));
  }

  for (const code of codes) {
    let query = supabase.from('roles').select('*').eq('code', code);
    if (!isSuperAdmin(user) && user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
    const { data: existing, error } = await query.maybeSingle();
    if (error) throw error;
    if (existing) {
      rows.push(existing as EmployeeRoleRow);
      continue;
    }

    const fallback = DEFAULT_ROLES.find((role) => role.code === code);
    if (!fallback) continue;
    const permissions = defaultPermissionsForRole(code);
    if (!isSuperAdmin(user) && permissions.length > 0 && !canAssignPermissionKeys(user, permissions)) continue;

    const { data: created, error: createError } = await supabase
      .from('roles')
      .insert({
        code: fallback.code,
        name: fallback.name,
        description: fallback.description,
        status: 'active',
        tenant_id: isSuperAdmin(user) ? null : user.tenant_id || null,
      })
      .select('*')
      .single();
    if (createError) throw createError;
    rows.push(created as EmployeeRoleRow);
  }

  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

async function permissionKeysForRoles(roles: EmployeeRoleRow[]): Promise<PermissionKey[]> {
  const roleIds = roles.map((role) => role.id);
  const permissionKeys = new Set<PermissionKey>();
  for (const role of roles) {
    for (const key of defaultPermissionsForRole(role.code)) permissionKeys.add(key);
  }
  if (roleIds.length === 0) return Array.from(permissionKeys);

  const { data } = await getSupabaseClient()
    .from('role_permissions')
    .select('role_id, permission:permissions(code)')
    .in('role_id', roleIds);

  for (const row of (data || []) as RolePermissionRow[]) {
    const code = row.permission?.code;
    if (code) permissionKeys.add(code as PermissionKey);
  }
  return Array.from(permissionKeys);
}

export async function replaceEmployeeRelations(
  employeeId: string,
  roleIdsOrCodes: string[],
  positionIds: string[],
  primaryPositionId: string | null,
  user: AuthUser,
) {
  const supabase = getSupabaseClient();
  const roles = await ensureEmployeeRoleRows(roleIdsOrCodes, user);

  await supabase.from('employee_positions').delete().eq('employee_id', employeeId);
  if (positionIds.length > 0) {
    const { error } = await supabase.from('employee_positions').insert(
      positionIds.map((positionId) => ({
        employee_id: employeeId,
        position_id: positionId,
        is_primary: positionId === primaryPositionId,
      })),
    );
    if (error) throw error;
  }

  await supabase.from('employee_roles').delete().eq('employee_id', employeeId);
  if (roles.length > 0) {
    const { error } = await supabase.from('employee_roles').insert(
      roles.map((role) => ({ employee_id: employeeId, role_id: role.id })),
    );
    if (error) throw error;
  }

  return roles;
}

export async function syncEmployeeUserPermissions(
  userId: string | null,
  tenantId: string | null,
  roles: EmployeeRoleRow[],
  assignedBy: string,
) {
  if (!userId) return;
  const supabase = getSupabaseClient();
  const permissionKeys = await permissionKeysForRoles(roles);
  let deleteQuery = supabase.from('user_permissions').delete().eq('user_id', userId);
  deleteQuery = tenantId ? deleteQuery.eq('tenant_id', tenantId) : deleteQuery.is('tenant_id', null);
  await deleteQuery;
  if (permissionKeys.length === 0) return;

  const { error } = await supabase.from('user_permissions').insert(
    permissionKeys.map((permissionKey) => ({
      user_id: userId,
      tenant_id: tenantId,
      permission_key: permissionKey,
      assigned_by: assignedBy,
    })),
  );
  if (error) throw error;
}

export async function ensureTenantMembership(input: {
  tenantId: string | null | undefined;
  userId: string | null | undefined;
  phone: string | null | undefined;
  name?: string | null;
  role?: string | null;
  department?: string | null;
  passwordHash?: string | null;
}) {
  if (!input.tenantId || !input.userId || !input.phone) return;
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { data: existing, error: findError } = await supabase
    .from('tenant_users')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (findError) throw findError;

  const row = {
    phone: input.phone,
    name: input.name || input.phone,
    role: input.role || 'employee',
    department: input.department || null,
    status: 'active',
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await supabase.from('tenant_users').update(row).eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('tenant_users').insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    password: input.passwordHash || '',
    ...row,
  });
  if (error) throw error;
}

export async function createOrReuseEmployeeLoginUser(body: Record<string, unknown>, user: AuthUser): Promise<string | null> {
  const shouldCreate = body.create_account === true || Boolean(text(body.password));
  const phone = text(body.phone);
  if (!shouldCreate) return text(body.user_id);
  if (!phone) throw new Error('创建登录账号需要填写手机号');

  const supabase = getSupabaseClient();
  const { data: existing, error: findError } = await supabase.from('users').select('id,password').eq('phone', phone).maybeSingle();
  if (findError) throw findError;
  if (existing?.id) {
    await ensureTenantMembership({
      tenantId: user.tenant_id,
      userId: existing.id,
      phone,
      name: text(body.name),
      role: 'employee',
      department: text(body.department_name),
      passwordHash: existing.password,
    });
    return existing.id;
  }

  const password = text(body.password) || phone.slice(-6).padStart(6, '0');
  if (password.length < 6) throw new Error('登录密码至少 6 位');

  const passwordHash = hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .insert({
      phone,
      password: passwordHash,
      real_name: text(body.name) || phone,
      nickname: text(body.name) || phone,
      role: 'employee',
      department: text(body.department_name),
      tenant_id: user.tenant_id || null,
      tenant_type: user.tenant_type || null,
      is_active: text(body.status) !== 'inactive',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  await ensureTenantMembership({
    tenantId: user.tenant_id,
    userId: data.id,
    phone,
    name: text(body.name),
    role: 'employee',
    department: text(body.department_name),
    passwordHash,
  });
  return data.id;
}
