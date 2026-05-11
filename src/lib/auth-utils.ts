import { getAccountRoleTemplate } from '@/lib/role-access';

export function isUserAdmin(user: { role?: string; tenant_type?: string; tenantId?: string }): boolean {
  const template = getAccountRoleTemplate(user.role);
  return Boolean(template && template.level <= 2);
}

// 获取用户所属租户类型
export function getTenantTypeLabel(tenantType: string): string {
  const labels: Record<string, string> = {
    'official': '官方管理',
    'manufacturer': '生产商',
    'factory': '工厂企业',
    'dealer': '经销商',
    'material_supplier': '材料商',
    'supplier': '供应商',
  };
  return labels[tenantType] || tenantType;
}
