import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authFailed, requireSettingsUser } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    const client = await createClient();
    const [{ data: roles, error: rolesError }, { data: permissions, error: permissionsError }] = await Promise.all([
      client
        .from('roles')
        .select('id,code,name,description,is_system')
        .eq('tenant_id', auth.context.enterpriseId)
        .order('created_at', { ascending: true }),
      client
        .from('permission_catalog')
        .select('code,description')
        .order('code', { ascending: true }),
    ]);
    if (rolesError || permissionsError) {
      return NextResponse.json({ success: false, error: '获取角色权限失败' }, { status: 500 });
    }
    const accountRoles = (roles ?? []).map((role) => ({
      id: role.id,
      value: role.code,
      label: role.name,
      level: role.is_system ? 1 : 2,
      businessType: auth.context.enterpriseType,
      department: '',
      description: role.description ?? '',
    }));
    const permissionOptions = (permissions ?? []).map((permission) => ({
      value: permission.code,
      label: permission.description,
      level: 1,
      businessType: permission.code.split('.')[0],
      department: '',
      description: permission.description,
    }));
    return NextResponse.json({
      success: true,
      accountRoles,
      permissions: permissionOptions,
      allAccountRoles: accountRoles,
      allPermissions: permissionOptions,
    });
  } catch (error) {
    console.error('get enterprise roles failed:', error);
    return NextResponse.json({ success: false, error: '获取角色权限失败' }, { status: 500 });
  }
}
