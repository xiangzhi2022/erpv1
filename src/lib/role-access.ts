import type { AuthUser, User } from '@/lib/auth';
import {
  Building2,
  Factory,
  FolderTree,
  HardHat,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  Package,
  RefreshCw,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AccountRole = 'super_admin' | 'factory_admin' | 'supplier_admin' | 'dealer_admin' | 'employee';
export type PermissionLevel = 1 | 2 | 3;
export type BusinessType = 'platform' | 'factory' | 'supplier' | 'dealer';

export type PermissionKey =
  | 'factory_order_manager'
  | 'factory_boss'
  | 'factory_production_manager'
  | 'factory_worker'
  | 'factory_data_entry'
  | 'factory_profit_view'
  | 'factory_carpenter'
  | 'factory_polisher'
  | 'factory_veneer'
  | 'factory_painter'
  | 'factory_quality'
  | 'factory_packer'
  | 'factory_admin_staff'
  | 'factory_finance'
  | 'factory_sales'
  | 'factory_shipping'
  | 'factory_general_worker'
  | 'dealer_order_entry'
  | 'dealer_accounting'
  | 'dealer_order_submitter'
  | 'dealer_order_tracker'
  | 'supplier_order_receive'
  | 'supplier_order_send';

export type AccessUser = Partial<AuthUser & User> & {
  role?: string;
  tenant_type?: string;
  department?: string;
  permissions?: string[];
};

export interface AccountRoleTemplate {
  role: AccountRole;
  label: string;
  level: PermissionLevel;
  businessType: BusinessType;
  department: string;
  description: string;
  landingPath: string;
  allowedPrefixes: string[];
}

export interface PermissionTemplate {
  key: PermissionKey;
  label: string;
  level: 3;
  businessType: Exclude<BusinessType, 'platform'>;
  department: string;
  description: string;
  landingPath: string;
  allowedPrefixes: string[];
  assignable?: boolean;
}

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  group: 'main' | 'workflow' | 'portal' | 'admin';
}

const S = {
  board: '数字看板',
  dashboard: '仪表盘',
  orders: '订单管理',
  orderExchanges: '订单流转',
  productionTasks: '生产任务',
  workerTasks: '我的任务',
  workerWages: '我的工资',
  wageRules: '工资规则',
  workerPerformance: '工人绩效',
  progress: '生产进度',
  tasks: '任务管理',
  dealer: '经销商',
  supplier: '供应商',
  factory: '工厂管理',
  workers: '工人管理',
  workerDesk: '工人工作台',
  factoryPortal: '工厂门户',
  workerPortal: '工人门户',
  employees: '员工管理',
  finance: '财务',
  shipping: '仓库发货',
  categories: '分类管理',
  settings: '系统设置',
  sync: '数据同步',
};

const COMMON_PROFILE_PREFIXES = ['/profile'];
const ADMIN_SETTINGS_PREFIXES = ['/settings'];
const SUPER_PREFIXES = [
  '/board',
  '/dashboard',
  '/orders',
  '/production/tasks',
  '/performance/workers',
  '/worker/tasks',
  '/worker/wages',
  '/orders/exchanges',
  '/progress',
  '/factory',
  '/worker',
  '/workers',
  '/employees',
  '/dealer',
  '/supplier',
  '/settings',
  '/categories',
  '/tasks',
  '/finance',
  '/shipping',
  '/sync',
];
const FACTORY_ADMIN_PREFIXES = ['/factory', '/orders', '/orders/exchanges', '/production/tasks', '/performance/workers', '/performance/orders', '/performance/production', '/progress', '/worker', '/worker/tasks', '/worker/wages', '/workers', '/employees', '/tasks', '/settings', '/shipping', '/finance', '/dealer'];
const SUPPLIER_ADMIN_PREFIXES = ['/supplier', '/orders', '/orders/exchanges', '/tasks', '/settings'];
const DEALER_ADMIN_PREFIXES = ['/dealer', '/orders', '/orders/exchanges', '/settings'];

export const ACCOUNT_ROLE_TEMPLATES: AccountRoleTemplate[] = [
  {
    role: 'super_admin',
    label: '超级管理员',
    level: 1,
    businessType: 'platform',
    department: '平台',
    description: '管理全平台、所有租户、所有账号和所有模块。',
    landingPath: '/board',
    allowedPrefixes: SUPER_PREFIXES,
  },
  {
    role: 'factory_admin',
    label: '工厂企业 ERP 管理员',
    level: 2,
    businessType: 'factory',
    department: '管理',
    description: '管理本工厂企业账号、订单、生产进度、工人、发货和财务。',
    landingPath: '/factory',
    allowedPrefixes: FACTORY_ADMIN_PREFIXES,
  },
  {
    role: 'supplier_admin',
    label: '供应商 ERP 管理员',
    level: 2,
    businessType: 'supplier',
    department: '供应',
    description: '管理本供应商账号、订单收发、任务和资料设置。',
    landingPath: '/supplier',
    allowedPrefixes: SUPPLIER_ADMIN_PREFIXES,
  },
  {
    role: 'dealer_admin',
    label: '经销商 ERP 管理员',
    level: 2,
    businessType: 'dealer',
    department: '经销',
    description: '管理本经销商账号、订单录入、核算、下单和订单跟踪。',
    landingPath: '/dealer',
    allowedPrefixes: DEALER_ADMIN_PREFIXES,
  },
  {
    role: 'employee',
    label: '员工',
    level: 3,
    businessType: 'platform',
    department: '员工',
    description: '员工账号，具体页面由多岗位权限决定。',
    landingPath: '/profile',
    allowedPrefixes: COMMON_PROFILE_PREFIXES,
  },
];

export const PERMISSION_TEMPLATES: PermissionTemplate[] = [
  { key: 'factory_boss', label: '老板', level: 3, businessType: 'factory', department: '管理', description: '查看全厂订单、生产、工资、成本、利润和绩效。', landingPath: '/board', allowedPrefixes: ['/board', '/dashboard', '/orders', '/production/tasks', '/performance/workers', '/performance/orders', '/performance/production', '/workers', '/employees', '/settings', '/finance', '/shipping', '/factory'] },
  { key: 'factory_production_manager', label: '生产主管', level: 3, businessType: 'factory', department: '生产管理', description: '拆单、分配生产任务、审核任务和确认计件工资。', landingPath: '/production/tasks', allowedPrefixes: ['/orders', '/production/tasks', '/performance/workers', '/performance/orders', '/performance/production', '/workers', '/employees', '/worker', '/worker/tasks', '/progress'] },
  { key: 'factory_worker', label: '工人', level: 3, businessType: 'factory', department: '生产', description: '查看本人生产任务、提交完成并查看本人计件工资。', landingPath: '/worker/tasks', allowedPrefixes: ['/worker', '/worker/tasks', '/worker/wages'] },
  { key: 'factory_data_entry', label: '录入员', level: 3, businessType: 'factory', department: '录入', description: '维护订单、空间、产品和生产基础数据，不查看价格、成本、利润和工资。', landingPath: '/orders', allowedPrefixes: ['/orders'] },
  { key: 'factory_profit_view', label: '利润查看', level: 3, businessType: 'factory', department: '财务', description: '允许查看成本和利润字段。', landingPath: '/finance', allowedPrefixes: ['/finance', '/orders', '/performance/workers'] },
  { key: 'factory_order_manager', label: '订单管理', level: 3, businessType: 'factory', department: '管理', description: '处理工厂订单接收、状态跟踪和订单流转。', landingPath: '/orders', allowedPrefixes: ['/orders', '/orders/exchanges', '/factory'] },
  { key: 'factory_carpenter', label: '木工', level: 3, businessType: 'factory', department: '生产', description: '查看木工工序任务并上报进度。', landingPath: '/worker/tasks', allowedPrefixes: ['/worker', '/worker/portal', '/worker/tasks', '/worker/wages', '/progress'] },
  { key: 'factory_polisher', label: '打磨', level: 3, businessType: 'factory', department: '生产', description: '查看打磨工序任务并上报进度。', landingPath: '/worker/tasks', allowedPrefixes: ['/worker', '/worker/portal', '/worker/tasks', '/worker/wages', '/progress'] },
  { key: 'factory_veneer', label: '贴皮', level: 3, businessType: 'factory', department: '生产', description: '查看贴皮工序任务并上报进度。', landingPath: '/worker/tasks', allowedPrefixes: ['/worker', '/worker/portal', '/worker/tasks', '/worker/wages', '/progress'] },
  { key: 'factory_painter', label: '喷漆', level: 3, businessType: 'factory', department: '生产', description: '查看喷漆工序任务并上报进度。', landingPath: '/worker/tasks', allowedPrefixes: ['/worker', '/worker/portal', '/worker/tasks', '/worker/wages', '/progress'] },
  { key: 'factory_quality', label: '质检', level: 3, businessType: 'factory', department: '生产', description: '处理质检工序、检查结果和进度上报。', landingPath: '/worker/tasks', allowedPrefixes: ['/worker', '/worker/portal', '/worker/tasks', '/worker/wages', '/progress'] },
  { key: 'factory_packer', label: '打包', level: 3, businessType: 'factory', department: '生产', description: '处理打包工序、包装进度和交付信息。', landingPath: '/worker/tasks', allowedPrefixes: ['/worker', '/worker/portal', '/worker/tasks', '/worker/wages', '/progress'] },
  { key: 'factory_admin_staff', label: '行政', level: 3, businessType: 'factory', department: '行政', description: '查看工厂后台和基础任务。', landingPath: '/factory', allowedPrefixes: ['/factory', '/tasks'] },
  { key: 'factory_finance', label: '财务', level: 3, businessType: 'factory', department: '财务', description: '查看财务、订单金额和必要订单信息。', landingPath: '/finance', allowedPrefixes: ['/finance', '/orders', '/performance/workers'] },
  { key: 'factory_sales', label: '销售', level: 3, businessType: 'factory', department: '销售', description: '处理销售订单、经销商协作和订单流转。', landingPath: '/orders', allowedPrefixes: ['/orders', '/orders/exchanges', '/dealer'] },
  { key: 'factory_shipping', label: '仓库发货', level: 3, businessType: 'factory', department: '仓储', description: '处理仓库发货、发货状态和必要订单信息。', landingPath: '/shipping', allowedPrefixes: ['/shipping', '/orders'] },
  { key: 'factory_general_worker', label: '普工', level: 3, businessType: 'factory', department: '生产', description: '查看普通生产任务并上报进度。', landingPath: '/worker/tasks', allowedPrefixes: ['/worker', '/worker/portal', '/worker/tasks', '/worker/wages', '/progress'] },
  { key: 'dealer_order_entry', label: '订单录入', level: 3, businessType: 'dealer', department: '订单', description: '录入客户和订单信息。', landingPath: '/orders', allowedPrefixes: ['/orders', '/orders/exchanges', '/dealer'] },
  { key: 'dealer_accounting', label: '订单核算', level: 3, businessType: 'dealer', department: '核算', description: '处理订单金额、结算和对账。', landingPath: '/orders', allowedPrefixes: ['/orders', '/dealer'] },
  { key: 'dealer_order_submitter', label: '下单', level: 3, businessType: 'dealer', department: '订单', description: '向工厂或供应商发起订单流转。', landingPath: '/orders/exchanges', allowedPrefixes: ['/orders', '/orders/exchanges', '/dealer'] },
  { key: 'dealer_order_tracker', label: '订单跟踪', level: 3, businessType: 'dealer', department: '跟踪', description: '查看订单状态、生产进度、发货状态和流转记录。', landingPath: '/orders/exchanges', allowedPrefixes: ['/orders', '/orders/exchanges', '/progress', '/shipping', '/dealer'] },
  { key: 'supplier_order_receive', label: '订单接收', level: 3, businessType: 'supplier', department: '订单', description: '接收、处理或拒绝来自协作方的订单。', landingPath: '/orders/exchanges', allowedPrefixes: ['/supplier', '/orders', '/orders/exchanges'] },
  { key: 'supplier_order_send', label: '订单发送', level: 3, businessType: 'supplier', department: '订单', description: '向协作方发起供应商侧订单流转。', landingPath: '/orders/exchanges', allowedPrefixes: ['/supplier', '/orders', '/orders/exchanges'], assignable: false },
];

const PERMISSION_PRIORITY: PermissionKey[] = [
  'factory_boss',
  'factory_production_manager',
  'dealer_order_submitter',
  'supplier_order_receive',
  'supplier_order_send',
  'factory_order_manager',
  'dealer_order_entry',
  'dealer_order_tracker',
  'factory_finance',
  'factory_data_entry',
  'factory_shipping',
  'factory_admin_staff',
  'factory_carpenter',
  'factory_polisher',
  'factory_veneer',
  'factory_painter',
  'factory_quality',
  'factory_packer',
  'factory_general_worker',
  'factory_worker',
];

const LEGACY_ROLE_ALIASES: Record<string, AccountRole> = {
  saas_admin: 'super_admin',
  user: 'employee',
  factory_user: 'employee',
  worker: 'employee',
  order_manager: 'employee',
  finance: 'employee',
  sales: 'employee',
  warehouse_shipping: 'employee',
};

const LEGACY_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  worker: ['factory_general_worker'],
  factory_user: ['factory_general_worker'],
  order_manager: ['factory_order_manager'],
  finance: ['factory_finance'],
  boss: ['factory_boss'],
  production_manager: ['factory_production_manager'],
  data_entry: ['factory_data_entry'],
  sales: ['factory_sales'],
  warehouse_shipping: ['factory_shipping'],
  user: [],
};

const TENANT_TYPE_TO_BUSINESS: Record<string, BusinessType> = {
  manufacturer: 'factory',
  producer: 'factory',
  factory: 'factory',
  dealer: 'dealer',
  distributor: 'dealer',
  material_supplier: 'supplier',
  supplier: 'supplier',
  official: 'platform',
};

const NAV_ITEMS: NavigationItem[] = [
  { title: S.board, href: '/board', icon: LayoutDashboard, group: 'main' },
  { title: S.dashboard, href: '/dashboard', icon: LayoutDashboard, group: 'main' },
  { title: S.orders, href: '/orders', icon: Package, group: 'main' },
  { title: S.orderExchanges, href: '/orders/exchanges', icon: ListChecks, group: 'workflow' },
  { title: S.productionTasks, href: '/production/tasks', icon: ListChecks, group: 'workflow' },
  { title: S.progress, href: '/progress', icon: RefreshCw, group: 'main' },
  { title: S.tasks, href: '/tasks', icon: ListTodo, group: 'main' },
  { title: S.dealer, href: '/dealer', icon: Building2, group: 'main' },
  { title: S.supplier, href: '/supplier', icon: Building2, group: 'main' },
  { title: S.factory, href: '/factory', icon: Factory, group: 'main' },
  { title: S.workers, href: '/workers', icon: Users, group: 'main' },
  { title: S.employees, href: '/employees', icon: Users, group: 'admin' },
  { title: S.workerDesk, href: '/worker', icon: HardHat, group: 'portal' },
  { title: S.workerTasks, href: '/worker/tasks', icon: HardHat, group: 'portal' },
  { title: S.workerWages, href: '/worker/wages', icon: Wallet, group: 'portal' },
  { title: S.factoryPortal, href: '/factory/portal', icon: Factory, group: 'portal' },
  { title: S.workerPortal, href: '/worker/portal', icon: HardHat, group: 'portal' },
  { title: S.finance, href: '/finance', icon: Wallet, group: 'main' },
  { title: S.shipping, href: '/shipping', icon: Truck, group: 'main' },
  { title: S.workerPerformance, href: '/performance/workers', icon: Users, group: 'main' },
  { title: S.categories, href: '/categories', icon: FolderTree, group: 'admin' },
  { title: S.wageRules, href: '/settings/wage-rules', icon: Wallet, group: 'admin' },
  { title: S.settings, href: '/settings', icon: Settings, group: 'admin' },
  { title: S.sync, href: '/sync', icon: ShieldCheck, group: 'admin' },
];

function enterpriseDirectoryTitleForUser(user: AccessUser): string {
  if (isSuperAdmin(user)) return '经销商管理';

  const role = normalizeAccountRole(rawRoleOf(user));
  const tenantBusinessType = tenantTypeToBusinessType(user.tenant_type);
  const permissions = getUserPermissionKeys(user);

  if (
    role === 'dealer_admin'
    || tenantBusinessType === 'dealer'
    || permissions.some((key) => getPermissionTemplate(key)?.businessType === 'dealer')
  ) {
    return '工厂企业';
  }

  if (
    role === 'factory_admin'
    || tenantBusinessType === 'factory'
    || permissions.some((key) => getPermissionTemplate(key)?.businessType === 'factory')
  ) {
    return '材料供应商';
  }

  return '企业库';
}

function rawRoleOf(user: AccessUser | null | undefined): string {
  return user?.role || 'guest';
}

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/board';
  return pathname.split('?')[0].replace(/\/$/, '') || '/board';
}

function pathStarts(pathname: string, prefix: string): boolean {
  const path = normalizePath(pathname);
  return path === prefix || path.startsWith(`${prefix}/`);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function normalizeAccountRole(role: string | undefined): AccountRole | 'guest' {
  if (!role) return 'guest';
  if (ACCOUNT_ROLE_TEMPLATES.some((template) => template.role === role)) return role as AccountRole;
  return LEGACY_ROLE_ALIASES[role] || 'employee';
}

export function getAccountRoleTemplate(role: string | undefined): AccountRoleTemplate | undefined {
  const normalized = normalizeAccountRole(role);
  return ACCOUNT_ROLE_TEMPLATES.find((template) => template.role === normalized);
}

export function getPermissionTemplate(key: string | undefined): PermissionTemplate | undefined {
  return PERMISSION_TEMPLATES.find((template) => template.key === key);
}

export function getAccountRoleLabel(role: string | undefined): string {
  return getAccountRoleTemplate(role)?.label || role || '访客';
}

export function getPermissionLabel(key: string | undefined): string {
  return getPermissionTemplate(key)?.label || key || '';
}

export function getUserPermissionKeys(user: AccessUser | null | undefined): PermissionKey[] {
  if (!user) return [];
  const direct = (user.permissions || []).filter((key): key is PermissionKey => Boolean(getPermissionTemplate(key)));
  const legacy = LEGACY_ROLE_PERMISSIONS[rawRoleOf(user)] || [];
  return unique([...direct, ...legacy]);
}

export function tenantTypeToBusinessType(tenantType: string | undefined): BusinessType {
  return tenantType ? TENANT_TYPE_TO_BUSINESS[tenantType] || 'platform' : 'platform';
}

export function isAdminRole(user: AccessUser | null | undefined): boolean {
  const template = getAccountRoleTemplate(rawRoleOf(user));
  return Boolean(template && template.level <= 2);
}

export function isSuperAdmin(user: AccessUser | null | undefined): boolean {
  return normalizeAccountRole(rawRoleOf(user)) === 'super_admin';
}

export function isFactoryUser(user: AccessUser | null | undefined): boolean {
  if (!user) return false;
  if (normalizeAccountRole(rawRoleOf(user)) === 'factory_admin') return true;
  if (tenantTypeToBusinessType(user.tenant_type) === 'factory') return true;
  return getUserPermissionKeys(user).some((key) => getPermissionTemplate(key)?.businessType === 'factory');
}

export function getLandingPath(user: AccessUser | null | undefined): string {
  if (!user) return '/login';
  const roleTemplate = getAccountRoleTemplate(rawRoleOf(user));
  if (roleTemplate && roleTemplate.level <= 2) return roleTemplate.landingPath;

  const permissions = getUserPermissionKeys(user);
  const firstPermission = PERMISSION_PRIORITY.find((key) => permissions.includes(key)) || permissions[0];
  return getPermissionTemplate(firstPermission)?.landingPath || '/profile';
}

function allowedPrefixes(user: AccessUser): string[] {
  const roleTemplate = getAccountRoleTemplate(rawRoleOf(user));
  const prefixes: string[] = [];

  if (roleTemplate && roleTemplate.level <= 2) {
    prefixes.push(...roleTemplate.allowedPrefixes, ...ADMIN_SETTINGS_PREFIXES);
  } else {
    for (const key of getUserPermissionKeys(user)) {
      prefixes.push(...(getPermissionTemplate(key)?.allowedPrefixes || []));
    }
  }

  return unique([...prefixes, ...COMMON_PROFILE_PREFIXES]);
}

export function canAccessPath(user: AccessUser | null | undefined, pathname: string): boolean {
  if (!user) return false;
  const path = normalizePath(pathname);
  const permissions = getUserPermissionKeys(user);
  const canManageOrganization = isAdminRole(user) || permissions.includes('factory_boss');
  const canViewProductionEmployees = permissions.includes('factory_production_manager');
  if (pathStarts(path, '/employees')) return canManageOrganization || canViewProductionEmployees;
  if (
    ['/settings/departments', '/settings/positions', '/settings/roles'].some((prefix) => pathStarts(path, prefix))
  ) {
    return canManageOrganization || (canViewProductionEmployees && pathStarts(path, '/settings/positions'));
  }
  if (pathStarts(path, '/settings/wage-rules') && !isAdminRole(user)) {
    return permissions.some((key) =>
      key === 'factory_boss' || key === 'factory_production_manager'
    );
  }
  if ((path === '/settings' || pathStarts(path, '/settings')) && !isAdminRole(user)) return false;
  if (pathStarts(path, '/orders/exchanges') && !isAdminRole(user)) {
    return permissions.some((key) =>
      getPermissionTemplate(key)?.allowedPrefixes.some(
        (prefix) => prefix === '/orders/exchanges' || prefix.startsWith('/orders/exchanges/')
      )
    );
  }
  return allowedPrefixes(user).some((prefix) => pathStarts(path, prefix));
}

export function getNavigationForUser(user: AccessUser | null | undefined): NavigationItem[] {
  if (!user) return [];
  return NAV_ITEMS
    .filter((item) => canAccessPath(user, item.href))
    .map((item) => {
      if (item.href !== '/dealer') return item;
      return { ...item, title: enterpriseDirectoryTitleForUser(user) };
    });
}

export function getAssignableAccountRoles(user: AccessUser | null | undefined): AccountRoleTemplate[] {
  if (!user) return [];
  if (isSuperAdmin(user)) return ACCOUNT_ROLE_TEMPLATES.filter((template) => template.role !== 'super_admin');
  if (isAdminRole(user)) return ACCOUNT_ROLE_TEMPLATES.filter((template) => template.role === 'employee');
  return [];
}

export function getAssignablePermissions(user: AccessUser | null | undefined): PermissionTemplate[] {
  if (!user) return [];
  const assignablePermissions = PERMISSION_TEMPLATES.filter((template) => template.assignable !== false);
  if (isSuperAdmin(user)) return assignablePermissions;
  const businessType = getRoleManagementBusinessType(user);
  if (!businessType) return [];
  return assignablePermissions.filter((template) => template.businessType === businessType);
}

export function canAssignPermissionKeys(user: AccessUser | null | undefined, permissionKeys: string[]): boolean {
  const assignable = new Set(getAssignablePermissions(user).map((template) => template.key));
  return permissionKeys.every((key) => assignable.has(key as PermissionKey));
}

export function getRoleManagementBusinessType(user: AccessUser | null | undefined): Exclude<BusinessType, 'platform'> | null {
  if (!user || isSuperAdmin(user)) return null;

  const roleTemplate = getAccountRoleTemplate(rawRoleOf(user));
  if (roleTemplate?.level === 2 && roleTemplate.businessType !== 'platform') {
    return roleTemplate.businessType;
  }

  const permissions = getUserPermissionKeys(user);
  if (permissions.includes('factory_boss')) return 'factory';
  return null;
}

export function getAssignablePermissionKeys(user: AccessUser | null | undefined): PermissionKey[] {
  return getAssignablePermissions(user).map((permission) => permission.key);
}

export function filterAssignablePermissionKeys(user: AccessUser | null | undefined, permissionKeys: string[]): PermissionKey[] {
  const assignable = new Set(getAssignablePermissionKeys(user));
  return Array.from(
    new Set(
      permissionKeys.filter((key): key is PermissionKey => assignable.has(key as PermissionKey))
    )
  );
}

export function getDepartmentForPermissions(permissionKeys: string[]): string {
  const departments = unique(
    permissionKeys
      .map((key) => getPermissionTemplate(key)?.department)
      .filter((value): value is string => Boolean(value))
  );
  return departments.join(' / ');
}
