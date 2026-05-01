/**
 * 权限检查工具
 * 超级管理员可访问所有数据，普通用户只能访问自己创建的数据
 */

export interface AuthUser {
  id: string;
  phone: string;
  nickname: string;
  role: string;
}

/**
 * 判断用户是否为超级管理员
 */
export function isSuperAdmin(user: AuthUser | null): boolean {
  return user?.role === 'super_admin';
}

/**
 * 判断用户是否可以访问某条数据
 * 超级管理员可访问所有数据，普通用户只能访问自己创建的数据
 */
export function canAccessData(
  user: AuthUser | null, 
  dataCreatedBy: string | null | undefined
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return user.id === dataCreatedBy;
}

/**
 * 获取数据过滤条件
 * 超级管理员返回null（不过滤），普通用户返回创建者过滤条件
 */
export function getDataFilter(user: AuthUser | null, createdByField: string = 'created_by') {
  if (!user) return null;
  if (isSuperAdmin(user)) return null; // 不过滤
  return { [createdByField]: user.id };
}
