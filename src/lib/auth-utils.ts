// 管理员权限检查工具

// 判断用户是否为管理员
// 规则：
// 1. 超级管理员 (super_admin) 永远是管理员
// 2. 生产商 (manufacturer) 租户的所有用户都是管理员
// 3. 订单管理 (订单管理) 角色拥有管理员权限

export function isUserAdmin(user: { role?: string; tenant_type?: string; tenantId?: string }): boolean {
  // 1. 超级管理员
  if (user.role === 'super_admin') {
    return true;
  }

  // 2. 生产商租户的用户（默认拥有管理员权限）
  if (user.tenant_type === 'manufacturer') {
    return true;
  }

  // 3. 订单管理角色拥有管理员权限
  if (user.role === '订单管理') {
    return true;
  }

  return false;
}

// 获取用户所属租户类型
export function getTenantTypeLabel(tenantType: string): string {
  const labels: Record<string, string> = {
    'official': '官方管理',
    'manufacturer': '生产商',
    'dealer': '经销商',
    'material_supplier': '材料商',
  };
  return labels[tenantType] || tenantType;
}
