import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import {
  createManagedIdentity,
  findManagedIdentityByPhone,
  updateManagedIdentityPassword,
} from '@/lib/admin/user-identities';
import { createClient } from '@/lib/supabase/server';
import { authFailed, requireSettingsUser } from '../_utils';

const createUserSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  password: z.string().min(8, '密码至少 8 位'),
  real_name: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.string().trim().regex(/^[A-Za-z0-9_.-]+$/).optional(),
});

const updateUserSchema = z.object({
  real_name: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.string().trim().regex(/^[A-Za-z0-9_.-]+$/).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  password: z.string().min(8).optional(),
});

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
        real_name: profile?.display_name ?? membership.display_name,
        nickname: profile?.display_name ?? membership.display_name,
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
    const body = await parseJson(request, createUserSchema);
    const role = await resolveEnterpriseRole(body.role, auth.context.enterpriseId);
    if (!role) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 400 });

    const found = await findManagedIdentityByPhone(body.phone);
    if (found.error) return NextResponse.json({ success: false, error: '查询认证账号失败' }, { status: 503 });
    let userId = found.identity?.id ?? null;
    let createdIdentity = false;
    if (!userId) {
      const result = await createManagedIdentity({
        phone: body.phone,
        password: body.password,
        displayName: body.real_name ?? body.name ?? body.phone,
      });
      if (result.error || !result.data.user) {
        return NextResponse.json({ success: false, error: '创建认证账号失败' }, { status: 503 });
      }
      userId = result.data.user.id;
      createdIdentity = true;
    }

    const client = await createClient();
    const displayName = body.real_name ?? body.name ?? body.phone;
    const { data: existing } = await client
      .from('enterprise_memberships')
      .select('id')
      .eq('tenant_id', auth.context.enterpriseId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ success: false, error: '该账号已属于当前企业' }, { status: 409 });
    }
    const { data: membership, error: membershipError } = await client
      .from('enterprise_memberships')
      .insert({
        tenant_id: auth.context.enterpriseId,
        user_id: userId,
        display_name: displayName,
        status: 'active',
      })
      .select('id,user_id,display_name,status,created_at')
      .single();
    if (membershipError) {
      return NextResponse.json({ success: false, error: '创建企业成员失败' }, { status: 500 });
    }
    await client.from('profiles').upsert({
      id: userId,
      enterprise_id: auth.context.enterpriseId,
      phone: body.phone,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    const { error: bindingError } = await client.from('role_bindings').insert({
      tenant_id: auth.context.enterpriseId,
      membership_id: membership.id,
      role_id: role.id,
      scope_kind: 'enterprise',
    });
    if (bindingError) {
      await client.from('enterprise_memberships').delete().eq('tenant_id', auth.context.enterpriseId).eq('id', membership.id);
      return NextResponse.json({ success: false, error: '分配企业角色失败' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        membership_id: membership.id,
        phone: body.phone,
        real_name: displayName,
        role: role.code,
        status: 'active',
        is_active: true,
        tenant_id: auth.context.enterpriseId,
        created_identity: createdIdentity,
      },
    }, { status: 201 });
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
    const client = await createClient();
    const { data: membership } = await client
      .from('enterprise_memberships')
      .select('id,display_name,status')
      .eq('tenant_id', auth.context.enterpriseId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    const displayName = body.real_name ?? body.name;
    const membershipStatus = body.status === 'inactive' ? 'suspended' : body.status;
    if (displayName || membershipStatus) {
      const { error } = await client
        .from('enterprise_memberships')
        .update({
          ...(displayName ? { display_name: displayName } : {}),
          ...(membershipStatus ? { status: membershipStatus } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', auth.context.enterpriseId)
        .eq('id', membership.id);
      if (error) return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
    }
    if (displayName) {
      await client.from('profiles').update({ display_name: displayName }).eq('enterprise_id', auth.context.enterpriseId).eq('id', userId);
    }
    if (body.role) {
      const role = await resolveEnterpriseRole(body.role, auth.context.enterpriseId);
      if (!role) return NextResponse.json({ success: false, error: '角色不存在' }, { status: 400 });
      await client.from('role_bindings').delete().eq('tenant_id', auth.context.enterpriseId).eq('membership_id', membership.id).eq('scope_kind', 'enterprise');
      const { error } = await client.from('role_bindings').insert({
        tenant_id: auth.context.enterpriseId,
        membership_id: membership.id,
        role_id: role.id,
        scope_kind: 'enterprise',
      });
      if (error) return NextResponse.json({ success: false, error: '更新角色失败' }, { status: 500 });
    }
    if (body.password) {
      const { error } = await updateManagedIdentityPassword(userId, body.password);
      if (error) return NextResponse.json({ success: false, error: '更新认证密码失败' }, { status: 503 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
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
    if (userId === auth.user.id) {
      return NextResponse.json({ success: false, error: '不能移除当前登录账号' }, { status: 400 });
    }
    const client = await createClient();
    const { data: membership } = await client
      .from('enterprise_memberships')
      .select('id')
      .eq('tenant_id', auth.context.enterpriseId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    const { error } = await client
      .from('enterprise_memberships')
      .delete()
      .eq('tenant_id', auth.context.enterpriseId)
      .eq('id', membership.id);
    if (error) return NextResponse.json({ success: false, error: '移除企业成员失败' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('remove enterprise user failed:', error);
    return NextResponse.json({ success: false, error: '移除企业成员失败' }, { status: 500 });
  }
}
