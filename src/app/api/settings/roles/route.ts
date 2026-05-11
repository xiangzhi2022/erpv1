import { NextRequest, NextResponse } from 'next/server';
import {
  ACCOUNT_ROLE_TEMPLATES,
  PERMISSION_TEMPLATES,
  getAssignableAccountRoles,
  getAssignablePermissions,
} from '@/lib/role-access';
import { authFailed, requireSettingsUser } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const accountRoles = getAssignableAccountRoles(auth.user).map((role) => ({
      value: role.role,
      label: role.label,
      level: role.level,
      businessType: role.businessType,
      department: role.department,
      description: role.description,
    }));

    const permissions = getAssignablePermissions(auth.user).map((permission) => ({
      value: permission.key,
      label: permission.label,
      level: permission.level,
      businessType: permission.businessType,
      department: permission.department,
      description: permission.description,
    }));

    return NextResponse.json({
      success: true,
      accountRoles,
      permissions,
      allAccountRoles: ACCOUNT_ROLE_TEMPLATES,
      allPermissions: PERMISSION_TEMPLATES,
    });
  } catch (error) {
    console.error('get roles failed:', error);
    return NextResponse.json({ success: false, error: '获取角色权限失败' }, { status: 500 });
  }
}
