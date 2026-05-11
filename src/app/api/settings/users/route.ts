import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { hashPassword } from '@/lib/auth';
import {
  getAccountRoleTemplate,
  getDepartmentForPermissions,
  getPermissionTemplate,
  isSuperAdmin,
  normalizeAccountRole,
  canAssignPermissionKeys,
  type AccountRole,
  type PermissionKey,
} from '@/lib/role-access';
import { authFailed, isSettingsAdmin, normalizeTenant, requireSettingsUser } from '../_utils';

interface UserRow {
  id: string;
  phone: string;
  real_name: string | null;
  nickname: string | null;
  role: string;
  department: string | null;
  is_active: boolean;
  tenant_id: string | null;
  tenant_type: string | null;
  created_at: string | null;
}

interface PermissionRow {
  user_id: string;
  permission_key: string | null;
}

function normalizeBodyRole(value: unknown): AccountRole {
  const role = typeof value === 'string' ? normalizeAccountRole(value) : 'employee';
  return role === 'guest' ? 'employee' : role;
}

function sanitizePermissionKeys(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((key): key is string => typeof key === 'string' && Boolean(getPermissionTemplate(key)))
        .map((key) => key as PermissionKey)
    )
  );
}

function activeStatusFromBody(body: Record<string, unknown>): boolean | undefined {
  if (typeof body.is_active === 'boolean') return body.is_active;
  if (body.status === 'active') return true;
  if (body.status === 'inactive') return false;
  return undefined;
}

function canManageUser(authUser: { role: string; tenant_id?: string }, target: Pick<UserRow, 'role' | 'tenant_id'>): boolean {
  if (isSuperAdmin(authUser)) return true;
  return normalizeAccountRole(target.role) === 'employee' && Boolean(authUser.tenant_id) && target.tenant_id === authUser.tenant_id;
}

async function loadPermissionsForUsers(userIds: string[]): Promise<Map<string, PermissionKey[]>> {
  const map = new Map<string, PermissionKey[]>();
  if (userIds.length === 0) return map;

  const { data } = await getSupabaseClient()
    .from('user_permissions')
    .select('user_id, permission_key')
    .in('user_id', userIds);

  for (const row of (data || []) as PermissionRow[]) {
    if (!row.permission_key || !getPermissionTemplate(row.permission_key)) continue;
    const values = map.get(row.user_id) || [];
    values.push(row.permission_key as PermissionKey);
    map.set(row.user_id, values);
  }
  return map;
}

async function replaceUserPermissions(userId: string, tenantId: string | null, permissionKeys: PermissionKey[], assignedBy: string) {
  const supabase = getSupabaseClient();
  await supabase.from('user_permissions').delete().eq('user_id', userId);
  if (permissionKeys.length === 0) return;

  const inserts = permissionKeys.map((permissionKey) => ({
    user_id: userId,
    tenant_id: tenantId,
    permission_key: permissionKey,
    assigned_by: assignedBy,
  }));
  const { error } = await supabase.from('user_permissions').insert(inserts);
  if (error) throw error;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!isSettingsAdmin(auth.user)) {
      return NextResponse.json({ success: false, error: '无权限访问用户管理' }, { status: 403 });
    }

    const supabase = getSupabaseClient();
    const tenantId = new URL(request.url).searchParams.get('tenant_id');
    let query = supabase
      .from('users')
      .select('id, phone, real_name, nickname, role, department, is_active, tenant_id, tenant_type, created_at')
      .order('created_at', { ascending: false });

    if (isSuperAdmin(auth.user)) {
      if (tenantId) query = query.eq('tenant_id', tenantId);
    } else {
      if (!auth.user.tenant_id) {
        return NextResponse.json({ success: false, error: '当前管理员未关联企业' }, { status: 403 });
      }
      query = query.eq('tenant_id', auth.user.tenant_id);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const rows = (data || []) as UserRow[];
    const permissionMap = await loadPermissionsForUsers(rows.map((row) => row.id));
    const tenantIds = Array.from(new Set(rows.map((row) => row.tenant_id).filter((id): id is string => Boolean(id))));
    const tenantMap = new Map<string, ReturnType<typeof normalizeTenant>>();

    if (tenantIds.length > 0) {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name, company_name, tenant_type, prefix, status, created_at, updated_at')
        .in('id', tenantIds);
      for (const tenant of tenants || []) tenantMap.set(tenant.id, normalizeTenant(tenant));
    }

    const users = rows.map((row) => {
      const permissions = permissionMap.get(row.id) || [];
      const tenant = row.tenant_id ? tenantMap.get(row.tenant_id) : null;
      return {
        ...row,
        nickname: row.nickname || row.real_name || row.phone,
        status: row.is_active ? 'active' : 'inactive',
        permissions,
        permission_labels: permissions.map((key) => getPermissionTemplate(key)?.label || key),
        tenant_type: tenant?.tenant_type || row.tenant_type || '',
        tenant_name: tenant?.company_name || '',
      };
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('get users failed:', error);
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!isSettingsAdmin(auth.user)) {
      return NextResponse.json({ success: false, error: '无权限创建用户' }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const realName = typeof body.real_name === 'string' ? body.real_name.trim() : '';
    const requestedRole = normalizeBodyRole(body.role);
    const permissionKeys = requestedRole === 'employee' ? sanitizePermissionKeys(body.permissions) : [];

    if (!phone || !password) {
      return NextResponse.json({ success: false, error: '请输入手机号和密码' }, { status: 400 });
    }
    if (!/^1\d{10}$/.test(phone)) {
      return NextResponse.json({ success: false, error: '手机号格式不正确' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, error: '密码至少 6 位' }, { status: 400 });
    }
    if (!isSuperAdmin(auth.user) && requestedRole !== 'employee') {
      return NextResponse.json({ success: false, error: '二级管理员只能创建员工账号' }, { status: 403 });
    }
    if (requestedRole === 'super_admin') {
      return NextResponse.json({ success: false, error: '不能通过此入口创建超级管理员' }, { status: 400 });
    }
    if (permissionKeys.length > 0 && !canAssignPermissionKeys(auth.user, permissionKeys)) {
      return NextResponse.json({ success: false, error: '包含不可分配的权限' }, { status: 403 });
    }

    const tenantId = isSuperAdmin(auth.user)
      ? (typeof body.tenant_id === 'string' && body.tenant_id ? body.tenant_id : null)
      : auth.user.tenant_id || null;
    if (!isSuperAdmin(auth.user) && !tenantId) {
      return NextResponse.json({ success: false, error: '当前管理员未关联企业' }, { status: 403 });
    }

    const supabase = getSupabaseClient();
    const { data: existingUser } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
    if (existingUser) {
      return NextResponse.json({ success: false, error: '手机号已存在' }, { status: 400 });
    }

    const department = typeof body.department === 'string' && body.department.trim()
      ? body.department.trim()
      : getDepartmentForPermissions(permissionKeys) || getAccountRoleTemplate(requestedRole)?.department || null;

    const { data, error } = await supabase
      .from('users')
      .insert({
        phone,
        password: hashPassword(password),
        real_name: realName || phone,
        nickname: realName || phone,
        role: requestedRole,
        department,
        tenant_id: tenantId,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('id, phone, real_name, nickname, role, department, is_active, tenant_id, tenant_type, created_at')
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || '创建用户失败' }, { status: 500 });
    }

    await replaceUserPermissions(data.id, data.tenant_id || tenantId, permissionKeys, auth.user.id);

    return NextResponse.json({
      success: true,
      user: {
        ...data,
        status: data.is_active ? 'active' : 'inactive',
        permissions: permissionKeys,
      },
    });
  } catch (error) {
    console.error('create user failed:', error);
    return NextResponse.json({ success: false, error: '创建用户失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!isSettingsAdmin(auth.user)) {
      return NextResponse.json({ success: false, error: '无权限更新用户' }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: '缺少用户 ID' }, { status: 400 });

    const supabase = getSupabaseClient();
    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('id, role, tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }
    if (!canManageUser(auth.user, existing as UserRow)) {
      return NextResponse.json({ success: false, error: '无权管理该用户' }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const requestedRole = body.role !== undefined ? normalizeBodyRole(body.role) : normalizeBodyRole(existing.role);
    const permissionKeys = body.permissions !== undefined && requestedRole === 'employee'
      ? sanitizePermissionKeys(body.permissions)
      : null;

    if (!isSuperAdmin(auth.user) && requestedRole !== 'employee') {
      return NextResponse.json({ success: false, error: '二级管理员只能分配员工角色' }, { status: 403 });
    }
    if (requestedRole === 'super_admin' && !isSuperAdmin(auth.user)) {
      return NextResponse.json({ success: false, error: '无权分配超级管理员' }, { status: 403 });
    }
    if (permissionKeys && !canAssignPermissionKeys(auth.user, permissionKeys)) {
      return NextResponse.json({ success: false, error: '包含不可分配的权限' }, { status: 403 });
    }

    if (body.real_name !== undefined) updateData.real_name = String(body.real_name || '').trim();
    if (body.name !== undefined) updateData.real_name = String(body.name || '').trim();
    if (body.role !== undefined) updateData.role = requestedRole;
    if (body.department !== undefined) updateData.department = String(body.department || '').trim() || null;
    if (body.password) updateData.password = hashPassword(String(body.password));
    const active = activeStatusFromBody(body);
    if (active !== undefined) updateData.is_active = active;

    let tenantId = existing.tenant_id as string | null;
    if (isSuperAdmin(auth.user) && body.tenant_id !== undefined) {
      tenantId = typeof body.tenant_id === 'string' && body.tenant_id ? body.tenant_id : null;
      updateData.tenant_id = tenantId;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, phone, real_name, nickname, role, department, is_active, tenant_id, tenant_type, created_at')
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || '更新用户失败' }, { status: 500 });
    }

    if (permissionKeys) {
      const nextDepartment = getDepartmentForPermissions(permissionKeys);
      await replaceUserPermissions(id, tenantId, permissionKeys, auth.user.id);
      if (!updateData.department && nextDepartment) {
        await supabase.from('users').update({ department: nextDepartment }).eq('id', id);
        data.department = nextDepartment;
      }
    } else if (requestedRole !== 'employee') {
      await replaceUserPermissions(id, tenantId, [], auth.user.id);
    }

    const permissions = permissionKeys || (await loadPermissionsForUsers([id])).get(id) || [];

    return NextResponse.json({
      success: true,
      user: {
        ...data,
        status: data.is_active ? 'active' : 'inactive',
        permissions,
      },
    });
  } catch (error) {
    console.error('update user failed:', error);
    return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!isSettingsAdmin(auth.user)) {
      return NextResponse.json({ success: false, error: '无权限删除用户' }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: '缺少用户 ID' }, { status: 400 });
    if (id === auth.user.id) return NextResponse.json({ success: false, error: '不能删除当前登录账号' }, { status: 400 });

    const supabase = getSupabaseClient();
    const { data: existing } = await supabase.from('users').select('id, role, tenant_id').eq('id', id).maybeSingle();
    if (!existing) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    if (!canManageUser(auth.user, existing as UserRow)) {
      return NextResponse.json({ success: false, error: '无权删除该用户' }, { status: 403 });
    }

    await supabase.from('user_permissions').delete().eq('user_id', id);
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('delete user failed:', error);
    return NextResponse.json({ success: false, error: '删除用户失败' }, { status: 500 });
  }
}
