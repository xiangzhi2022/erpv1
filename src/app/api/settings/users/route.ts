import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { allowNullableRpcArgs } from '@/db/rpc-args';
import { isApiError } from '@/lib/api/errors';
import { parseJson } from '@/lib/api/request';
import { errorResponse } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { authFailed, requireSettingsUser } from '../_utils';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function requestId(request: Request): string {
  const candidate = request.headers.get('x-request-id');
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

const updateUserSchema = z.object({
  real_name: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.string().trim().regex(/^[A-Za-z0-9_.-]+$/).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  department: z.string().trim().max(100).optional(),
  tenant_id: z.string().uuid().optional(),
  permissions: z.array(z.string()).optional(),
}).strict();

async function resolveEnterpriseRole(roleIdOrCode: string | undefined, enterpriseId: string) {
  const client = await createClient();
  const normalizedRole = !roleIdOrCode || roleIdOrCode === 'employee' ? 'worker' : roleIdOrCode;
  let query = client
    .from('roles')
    .select('id,code,name')
    .eq('tenant_id', enterpriseId);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizedRole)) {
    query = query.eq('id', normalizedRole);
  } else {
    query = query.eq('code', normalizedRole);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    const client = await createClient();
    const { data: memberships, error } = await client
      .from('enterprise_memberships')
      .select('id,user_id,display_name,status,created_at')
      .eq('tenant_id', auth.context.enterpriseId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 });

    const userIds = (memberships ?? []).map((membership) => membership.user_id);
    const membershipIds = (memberships ?? []).map((membership) => membership.id);
    const [{ data: profiles }, { data: bindings }] = await Promise.all([
      userIds.length
        ? client
            .from('profiles')
            .select('id,phone,display_name,avatar_url')
            .eq('enterprise_id', auth.context.enterpriseId)
            .in('id', userIds)
        : Promise.resolve({ data: [] }),
      membershipIds.length
        ? client
            .from('role_bindings')
            .select('membership_id,role:roles(id,code,name)')
            .eq('tenant_id', auth.context.enterpriseId)
            .eq('scope_kind', 'enterprise')
            .in('membership_id', membershipIds)
        : Promise.resolve({ data: [] }),
    ]);
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const bindingMap = new Map((bindings ?? []).map((binding) => [binding.membership_id, binding.role]));
    const roleIds = (bindings ?? []).flatMap((binding) => binding.role ? [binding.role.id] : []);
    const { data: permissionRows } = roleIds.length
      ? await client
          .from('role_permissions')
          .select('role_id,permission_code')
          .eq('tenant_id', auth.context.enterpriseId)
          .in('role_id', roleIds)
      : { data: [] };
    const permissionMap = new Map<string, string[]>();
    for (const row of permissionRows ?? []) {
      permissionMap.set(row.role_id, [...(permissionMap.get(row.role_id) ?? []), row.permission_code]);
    }

    const users = (memberships ?? []).map((membership) => {
      const profile = profileMap.get(membership.user_id);
      const role = bindingMap.get(membership.id);
      const permissions = role ? permissionMap.get(role.id) ?? [] : [];
      return {
        id: membership.user_id,
        membership_id: membership.id,
        phone: profile?.phone ?? '',
        real_name: membership.display_name,
        nickname: membership.display_name,
        role: role?.code ?? 'employee',
        role_id: role?.id ?? null,
        department: null,
        is_active: membership.status === 'active',
        status: membership.status,
        tenant_id: auth.context.enterpriseId,
        tenant_type: auth.context.enterpriseType,
        tenant_name: auth.context.enterpriseName,
        created_at: membership.created_at,
        permissions,
        permission_labels: permissions,
      };
    });
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('get enterprise users failed:', error);
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    return NextResponse.json({
      success: false,
      error: '企业管理员不能直接创建登录账号；请让用户自行注册后提交加入申请，再由管理员审批。',
    }, { status: 409 });
  } catch (error) {
    console.error('create enterprise user failed:', error);
    return NextResponse.json({ success: false, error: '创建用户失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    const userId = request.nextUrl.searchParams.get('id');
    if (!userId) return NextResponse.json({ success: false, error: '缺少用户 ID' }, { status: 400 });
    const body = await parseJson(request, updateUserSchema);
    const displayName = body.real_name ?? body.name;
    const membershipStatus = body.status === 'inactive' ? 'suspended' : body.status;
    const client = await createClient();
    let roleId: string | null = null;
    if (body.role) {
      const role = await resolveEnterpriseRole(body.role, auth.context.enterpriseId);
      if (!role) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 400 });
      roleId = role.id;
    }
    const { error } = await client.rpc('update_enterprise_member', allowNullableRpcArgs<
      'update_enterprise_member',
      'target_display_name' | 'target_role_id' | 'target_status'
    >({
      target_display_name: displayName ?? null,
      target_enterprise_id: auth.context.enterpriseId,
      target_role_id: roleId,
      target_status: membershipStatus ?? null,
      target_user_id: userId,
    }));
    if (error?.message === 'member_not_found') return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    if (error?.message === 'permission_denied') return NextResponse.json({ success: false, error: '没有更新成员或角色的权限' }, { status: 403 });
    if (error?.message === 'owner_protected') return NextResponse.json({ success: false, error: '只有企业所有者可以修改所有者账号' }, { status: 403 });
    if (error?.message === 'role_not_assignable') return NextResponse.json({ success: false, error: '不能分配超出当前账号权限范围的角色' }, { status: 403 });
    if (error?.message === 'last_owner_required') return NextResponse.json({ success: false, error: '企业必须保留至少一名启用的所有者' }, { status: 409 });
    if (error?.message === 'role_required') return NextResponse.json({ success: false, error: '重新启用成员时必须明确分配角色' }, { status: 409 });
    if (error?.message === 'cannot_suspend_self') return NextResponse.json({ success: false, error: '不能停用当前登录账号' }, { status: 409 });
    if (error) return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isApiError(error)) {
      return errorResponse(error, error.status, requestId(request), error.responseHeaders);
    }
    console.error('update enterprise user failed:', error);
    return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    const userId = request.nextUrl.searchParams.get('id');
    if (!userId) return NextResponse.json({ success: false, error: '缺少用户 ID' }, { status: 400 });
    const client = await createClient();
    const { error } = await client.rpc('remove_enterprise_member', {
      target_enterprise_id: auth.context.enterpriseId,
      target_user_id: userId,
    });
    if (error?.message === 'member_not_found') return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    if (error?.message === 'cannot_remove_self') return NextResponse.json({ success: false, error: '不能移除当前登录账号' }, { status: 409 });
    if (error?.message === 'owner_protected') return NextResponse.json({ success: false, error: '只有企业所有者可以移除所有者账号' }, { status: 403 });
    if (error?.message === 'last_owner_required') return NextResponse.json({ success: false, error: '企业必须保留至少一名启用的所有者' }, { status: 409 });
    if (error?.message === 'permission_denied') return NextResponse.json({ success: false, error: '没有移除成员的权限' }, { status: 403 });
    if (error) return NextResponse.json({ success: false, error: '移除企业成员失败' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('remove enterprise user failed:', error);
    return NextResponse.json({ success: false, error: '移除企业成员失败' }, { status: 500 });
  }
}
