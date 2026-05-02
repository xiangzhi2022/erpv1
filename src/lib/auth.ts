/**
 * 青崖ERP - 多租户权限控制工具
 * 支持角色：super_admin / saas_admin / dealer_admin / factory_admin / factory_user
 */

// 用户类型定义
export type UserRole = 'super_admin' | 'saas_admin' | 'dealer_admin' | 'factory_admin' | 'factory_user' | 'user';

export interface AuthUser {
  id: string;
  phone: string;
  nickname: string;
  role: UserRole;
  tenant_id?: string;     // 所属租户ID
  tenant_type?: 'dealer' | 'factory';  // 租户类型
}

// 角色层级（数值越大权限越高）
export const roleHierarchy: Record<UserRole, number> = {
  'super_admin': 100,      // 系统开发商
  'saas_admin': 80,       // SaaS服务商管理员
  'dealer_admin': 50,     // 经销商管理员
  'factory_admin': 40,    // 工厂管理员
  'factory_user': 30,     // 工厂工人
  'user': 10,             // 普通用户
};

/**
 * 判断用户是否为超级管理员（系统开发商）
 */
export function isSuperAdmin(user: AuthUser | null): boolean {
  return user?.role === 'super_admin';
}

/**
 * 判断用户是否为SaaS服务商管理员
 */
export function isSaasAdmin(user: AuthUser | null): boolean {
  return user?.role === 'saas_admin';
}

/**
 * 判断用户是否为经销商管理员
 */
export function isDealerAdmin(user: AuthUser | null): boolean {
  return user?.role === 'dealer_admin';
}

/**
 * 判断用户是否为工厂管理员
 */
export function isFactoryAdmin(user: AuthUser | null): boolean {
  return user?.role === 'factory_admin';
}

/**
 * 判断用户是否为工厂工人
 */
export function isFactoryUser(user: AuthUser | null): boolean {
  return user?.role === 'factory_user';
}

/**
 * 判断用户是否为工厂相关角色
 */
export function isFactoryUserRole(user: AuthUser | null): boolean {
  return isFactoryAdmin(user) || isFactoryUser(user);
}

/**
 * 判断用户是否可以管理所有数据
 * 超级管理员和SaaS管理员可以管理所有数据
 */
export function canManageAllData(user: AuthUser | null): boolean {
  if (!user) return false;
  return isSuperAdmin(user) || isSaasAdmin(user);
}

/**
 * 判断用户是否可以访问某条数据
 * 实现多租户数据隔离
 */
export function canAccessData(
  user: AuthUser | null,
  dataTenantId?: string | null,
  dataCreatedBy?: string | null
): boolean {
  if (!user) return false;
  
  // 超级管理员和SaaS管理员可以访问所有数据
  if (canManageAllData(user)) return true;
  
  // 经销商只能访问自己租户的数据
  if (isDealerAdmin(user)) {
    return user.tenant_id === dataTenantId;
  }
  
  // 工厂用户只能访问自己工厂的数据
  if (isFactoryUserRole(user)) {
    return user.tenant_id === dataTenantId;
  }
  
  // 普通用户只能访问自己创建的数据
  if (user.role === 'user') {
    return user.id === dataCreatedBy;
  }
  
  return false;
}

/**
 * 获取订单过滤条件
 * 根据用户角色返回不同的过滤条件
 */
export function getOrderFilter(user: AuthUser | null): { dealer_id?: string; target_factory_id?: string } | null {
  if (!user) return null;
  
  // 超级管理员和SaaS管理员不过滤
  if (canManageAllData(user)) return null;
  
  // 经销商：只查看自己下的订单
  if (isDealerAdmin(user)) {
    return { dealer_id: user.tenant_id };
  }
  
  // 工厂用户：只查看派给自己的订单
  if (isFactoryUserRole(user)) {
    return { target_factory_id: user.tenant_id };
  }
  
  return null;
}

/**
 * 获取用户根据角色跳转的首页路径
 */
export function getDashboardPath(user: AuthUser | null): string {
  if (!user) return '/login';
  
  switch (user.role) {
    case 'super_admin':
    case 'saas_admin':
      return '/dashboard';  // 后台管理
    case 'dealer_admin':
      return '/dealer';    // 经销商下单页
    case 'factory_admin':
      return '/factory';    // 工厂管理页
    case 'factory_user':
      return '/worker';     // 工人报工页
    default:
      return '/';
  }
}

/**
 * 判断用户是否有某项权限
 */
export function hasPermission(user: AuthUser | null, requiredRole: UserRole): boolean {
  if (!user) return false;
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}

/**
 * 权限矩阵定义
 */
export const permissions = {
  // 订单权限
  'orders:create': ['super_admin', 'saas_admin', 'dealer_admin'] as UserRole[],
  'orders:read:all': ['super_admin', 'saas_admin'] as UserRole[],
  'orders:read:dealer': ['dealer_admin'] as UserRole[],
  'orders:read:factory': ['factory_admin', 'factory_user'] as UserRole[],
  'orders:update': ['super_admin', 'saas_admin', 'dealer_admin', 'factory_admin'] as UserRole[],
  'orders:delete': ['super_admin', 'dealer_admin'] as UserRole[],
  'orders:assign_factory': ['dealer_admin'] as UserRole[],  // 派单
  
  // 生产任务权限
  'tasks:read': ['factory_admin', 'factory_user'] as UserRole[],
  'tasks:update_progress': ['factory_admin', 'factory_user'] as UserRole[],
  'tasks:assign_worker': ['factory_admin'] as UserRole[],
  
  // 用户管理权限
  'users:manage:all': ['super_admin'] as UserRole[],
  'users:manage:tenant': ['dealer_admin', 'factory_admin'] as UserRole[],
  
  // 工厂管理权限
  'factory:manage': ['super_admin', 'saas_admin'] as UserRole[],
  'factory:view_load': ['dealer_admin', 'factory_admin'] as UserRole[],  // 查看工厂负载
};

// 从请求中获取用户信息（用于API路由）
export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => {
      const [key, ...val] = c.split('=');
      return [key, val.join('=')];
    })
  );
  
  const userCookie = cookies['erp_user'];
  if (!userCookie) return null;
  
  try {
    return JSON.parse(decodeURIComponent(userCookie)) as AuthUser;
  } catch {
    return null;
  }
}
