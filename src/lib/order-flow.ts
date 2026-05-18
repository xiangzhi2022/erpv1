import type { AuthUser } from '@/lib/auth';
import {
  getUserPermissionKeys,
  isSuperAdmin,
  tenantTypeToBusinessType,
  type AccessUser,
} from '@/lib/role-access';

export type OrderFlow = 'dealer_to_factory' | 'factory_to_supplier' | 'legacy';
export type OrderMode = 'dealer' | 'factory_received' | 'factory_material' | 'supplier_received';
export type BusinessSide = 'platform' | 'dealer' | 'factory' | 'supplier';

export interface OrderModeConfig {
  mode: OrderMode;
  title: string;
  description: string;
  createLabel: string | null;
  partnerLabel: string | null;
  partnerTenantType: 'manufacturer' | 'material_supplier' | null;
  orderFlow: OrderFlow;
}

export const ORDER_MODE_CONFIG: Record<OrderMode, OrderModeConfig> = {
  dealer: {
    mode: 'dealer',
    title: '经销商订单管理',
    description: '经销商向工厂企业发起订单，并跟踪接收、生产和交付状态。',
    createLabel: '创建经销商订单',
    partnerLabel: '工厂企业',
    partnerTenantType: 'manufacturer',
    orderFlow: 'dealer_to_factory',
  },
  factory_received: {
    mode: 'factory_received',
    title: '工厂企业订单管理',
    description: '接收经销商订单，处理修改请求、生产流转和交付状态。',
    createLabel: null,
    partnerLabel: '经销商',
    partnerTenantType: null,
    orderFlow: 'dealer_to_factory',
  },
  factory_material: {
    mode: 'factory_material',
    title: '材料采购单',
    description: '工厂基于生产订单向材料商发起材料订单。',
    createLabel: '创建材料订单',
    partnerLabel: '材料商',
    partnerTenantType: 'material_supplier',
    orderFlow: 'factory_to_supplier',
  },
  supplier_received: {
    mode: 'supplier_received',
    title: '材料商订单管理',
    description: '材料商接收并处理来自工厂企业的材料订单。',
    createLabel: null,
    partnerLabel: '工厂企业',
    partnerTenantType: null,
    orderFlow: 'factory_to_supplier',
  },
};

export function getBusinessSide(user: Pick<AccessUser, 'role' | 'tenant_type' | 'permissions'> | null | undefined): BusinessSide {
  if (!user) return 'platform';
  if (isSuperAdmin(user)) return 'platform';

  const byTenant = tenantTypeToBusinessType(user.tenant_type);
  if (byTenant === 'dealer') return 'dealer';
  if (byTenant === 'factory') return 'factory';
  if (byTenant === 'supplier') return 'supplier';

  if (user.role === 'dealer_admin') return 'dealer';
  if (user.role === 'factory_admin') return 'factory';
  if (user.role === 'supplier_admin') return 'supplier';

  const permissions = getUserPermissionKeys(user);
  if (permissions.some((key) => key.startsWith('dealer_'))) return 'dealer';
  if (permissions.some((key) => key.startsWith('factory_'))) return 'factory';
  if (permissions.some((key) => key.startsWith('supplier_'))) return 'supplier';

  return 'platform';
}

export function getVisibleOrderModes(user: Pick<AuthUser, 'role' | 'tenant_type' | 'permissions'>): OrderMode[] {
  if (isSuperAdmin(user)) return ['dealer', 'factory_received', 'factory_material', 'supplier_received'];

  const side = getBusinessSide(user);
  if (side === 'dealer') return ['dealer'];
  if (side === 'factory') return ['factory_received', 'factory_material'];
  if (side === 'supplier') return ['supplier_received'];
  return [];
}

export function getDefaultOrderMode(user: Pick<AuthUser, 'role' | 'tenant_type' | 'permissions'>): OrderMode {
  const modes = getVisibleOrderModes(user);
  return modes[0] || 'dealer';
}

export function normalizeOrderMode(
  requestedMode: string | null | undefined,
  user: Pick<AuthUser, 'role' | 'tenant_type' | 'permissions'>
): OrderMode | null {
  const modes = getVisibleOrderModes(user);
  const fallback = getDefaultOrderMode(user);
  if (!requestedMode) return modes.includes(fallback) ? fallback : null;
  if (modes.includes(requestedMode as OrderMode)) return requestedMode as OrderMode;
  return null;
}

export function canCreateOrderInMode(
  user: Pick<AuthUser, 'role' | 'tenant_type' | 'permissions'>,
  mode: OrderMode
): boolean {
  if (isSuperAdmin(user)) return mode === 'dealer' || mode === 'factory_material';
  const side = getBusinessSide(user);
  const permissions = getUserPermissionKeys(user);

  if (mode === 'dealer') {
    return side === 'dealer' && (
      user.role === 'dealer_admin' ||
      permissions.includes('dealer_order_entry') ||
      permissions.includes('dealer_order_submitter')
    );
  }

  if (mode === 'factory_material') {
    return side === 'factory' && (
      user.role === 'factory_admin' ||
      permissions.includes('factory_order_manager') ||
      permissions.includes('factory_sales')
    );
  }

  return false;
}

export function modeForOrderFlow(flow: OrderFlow, receiverSide: BusinessSide): OrderMode {
  if (flow === 'dealer_to_factory') return receiverSide === 'factory' ? 'factory_received' : 'dealer';
  if (flow === 'factory_to_supplier') return receiverSide === 'supplier' ? 'supplier_received' : 'factory_material';
  return 'dealer';
}
