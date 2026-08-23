import type { EnterprisePermissionCode } from '@/lib/enterprise/permissions';

export type ApiRouteAccess = 'public' | 'authenticated' | 'enterprise' | 'development';

export interface ApiRoutePolicy {
  access: ApiRouteAccess;
  readPermission?: EnterprisePermissionCode;
  mutationPermission?: EnterprisePermissionCode;
  readPermissions?: readonly EnterprisePermissionCode[];
  mutationPermissions?: readonly EnterprisePermissionCode[];
}

type PolicyEntry = readonly [string, ApiRoutePolicy];

const publicRoutes = (paths: readonly string[]): PolicyEntry[] => paths.map((path) => [path, { access: 'public' }]);
const authenticatedRoutes = (paths: readonly string[]): PolicyEntry[] => paths.map((path) => [path, { access: 'authenticated' }]);
const developmentRoutes = (paths: readonly string[]): PolicyEntry[] => paths.map((path) => [path, { access: 'development' }]);
const enterpriseRoutes = (
  paths: readonly string[],
  readPermission: EnterprisePermissionCode,
  mutationPermission: EnterprisePermissionCode = readPermission,
): PolicyEntry[] => paths.map((path) => [path, {
  access: 'enterprise',
  readPermission,
  mutationPermission,
  readPermissions: [readPermission],
  mutationPermissions: [mutationPermission],
}]);
const enterpriseRoutesWithMutationPermissions = (
  paths: readonly string[],
  readPermission: EnterprisePermissionCode,
  mutationPermissions: readonly EnterprisePermissionCode[],
): PolicyEntry[] => paths.map((path) => [path, {
  access: 'enterprise',
  readPermission,
  mutationPermission: mutationPermissions[0],
  readPermissions: [readPermission],
  mutationPermissions,
}]);

export const API_ROUTE_POLICY_ENTRIES: readonly PolicyEntry[] = [
  ...publicRoutes([
    '/api/auth/email/send',
    '/api/auth/email/verify',
    '/api/auth/forgot-password',
    '/api/auth/login',
    '/api/auth/oauth/[provider]/callback',
    '/api/auth/oauth/[provider]',
    '/api/auth/register',
    '/api/auth/reset-password',
    '/api/auth/sms/send',
    '/api/auth/sms/verify',
  ]),
  ...authenticatedRoutes([
    '/api/auth/logout',
    '/api/auth/onboarding',
    '/api/organization-requests',
    '/api/organization-requests/[id]',
    '/api/organizations',
  ]),
  ...developmentRoutes([
    '/api/debug/env',
    '/api/debug/settings-test',
    '/api/debug/user',
  ]),
  ...enterpriseRoutes([
    '/api/categories/[id]',
    '/api/categories',
  ], 'catalog.read', 'catalog.manage'),
  ...enterpriseRoutes([
    '/api/customers',
  ], 'customers.read', 'customers.manage'),
  ...enterpriseRoutes([
    '/api/dashboard/activity',
    '/api/dashboard/chart',
    '/api/dashboard/finance-summary',
    '/api/dashboard/kpis',
    '/api/dashboard/order-status',
    '/api/dashboard/summary',
    '/api/dashboard/worker-ranking',
  ], 'dashboard.read'),
  ...enterpriseRoutes([
    '/api/dealer/[id]',
    '/api/dealer',
    '/api/enterprise-directory',
    '/api/factories',
    '/api/order-exchanges/partners',
    '/api/supplier/create',
    '/api/supplier/delete',
    '/api/supplier/list',
    '/api/supplier/update',
  ], 'partners.read', 'partners.manage'),
  ...enterpriseRoutes([
    '/api/supplier/orders',
  ], 'orders.read'),
  ...enterpriseRoutes([
    '/api/order-exchanges',
  ], 'orders.read', 'orders.submit'),
  ...enterpriseRoutesWithMutationPermissions([
    '/api/order-exchanges/[id]',
  ], 'orders.read', ['orders.update', 'orders.accept']),
  ...enterpriseRoutes([
    '/api/order-partners',
  ], 'orders.create'),
  ...enterpriseRoutes([
    '/api/dealer/orders/[id]',
    '/api/dealer/orders',
  ], 'orders.read'),
  ...enterpriseRoutes([
    '/api/dealer/orders/create',
  ], 'orders.read', 'orders.create'),
  ...enterpriseRoutes([
    '/api/factory/orders',
  ], 'orders.read', 'orders.accept'),
  ...enterpriseRoutes([
    '/api/orders/[id]',
    '/api/orders/[id]/spaces',
    '/api/spaces/[id]/products',
    '/api/spaces/[id]',
  ], 'orders.read', 'orders.update'),
  ...enterpriseRoutesWithMutationPermissions([
    '/api/orders/basic',
    '/api/orders',
  ], 'orders.read', ['orders.create', 'orders.update']),
  ...enterpriseRoutes([
    '/api/orders/generate',
  ], 'orders.read', 'orders.create'),
  ...enterpriseRoutes([
    '/api/orders/prefix',
  ], 'catalog.read'),
  ...enterpriseRoutes([
    '/api/orders/sequence',
  ], 'orders.create'),
  ...enterpriseRoutes([
    '/api/orders/[id]/split/confirm',
  ], 'production.read', 'production.plan'),
  ...enterpriseRoutes([
    '/api/orders/attachments',
  ], 'attachments.read', 'attachments.manage'),
  ...enterpriseRoutes([
    '/api/departments/[id]',
    '/api/departments',
    '/api/positions/[id]',
    '/api/positions',
  ], 'organization.read', 'organization.manage'),
  ...enterpriseRoutes([
    '/api/factory/workshops/[id]',
    '/api/factory/workshops',
  ], 'production.read', 'production.manage'),
  ...enterpriseRoutes([
    '/api/employees/[id]',
    '/api/employees',
    '/api/workers/[id]',
    '/api/workers/stats',
    '/api/workers',
    '/api/settings/users',
  ], 'members.read', 'members.manage'),
  ...enterpriseRoutes([
    '/api/employees/assignable',
  ], 'production.read'),
  ...enterpriseRoutes([
    '/api/permissions',
    '/api/roles/[id]/permissions',
    '/api/roles/[id]',
    '/api/roles',
    '/api/settings/roles',
  ], 'roles.manage'),
  ...enterpriseRoutes([
    '/api/notifications/[id]',
  ], 'notifications.read'),
  ...enterpriseRoutesWithMutationPermissions([
    '/api/notifications',
  ], 'notifications.read', ['notifications.read', 'tasks.manage', 'notifications.manage']),
  ...enterpriseRoutes([
    '/api/tasks/[id]',
    '/api/tasks',
  ], 'tasks.read', 'tasks.manage'),
  ...enterpriseRoutes([
    '/api/performance/orders',
    '/api/performance/production',
    '/api/production/tasks',
    '/api/progress/logs',
    '/api/progress/workshops',
    '/api/worker/me/tasks',
    '/api/worker/tasks',
  ], 'production.read'),
  ...enterpriseRoutes([
    '/api/production/eligible-workers',
  ], 'production.assign'),
  ...enterpriseRoutes([
    '/api/production/tasks/[id]/assign',
  ], 'production.assign'),
  ...enterpriseRoutes([
    '/api/production/tasks/[id]/abnormal',
    '/api/production/tasks/[id]/approve',
    '/api/production/tasks/[id]/review',
    '/api/production/tasks/[id]/rework',
  ], 'production.review'),
  ...enterpriseRoutes([
    '/api/production/tasks/[id]/start',
    '/api/production/tasks/[id]/submit',
    '/api/progress/report',
    '/api/worker/report',
  ], 'production.report.self'),
  ...enterpriseRoutes([
    '/api/production/tasks/[id]',
  ], 'production.read', 'production.plan'),
  ...enterpriseRoutes([
    '/api/progress/work-orders',
  ], 'production.read', 'production.plan'),
  ...enterpriseRoutes([
    '/api/products/[id]',
  ], 'orders.read', 'orders.update'),
  ...enterpriseRoutes([
    '/api/products/[id]/tasks',
  ], 'production.read', 'production.plan'),
  ...enterpriseRoutes([
    '/api/performance/workers/[id]',
    '/api/performance/workers',
    '/api/wage-records',
    '/api/workers/[id]/wages',
  ], 'wages.read.all'),
  ...enterpriseRoutes([
    '/api/wage-records/[id]',
    '/api/wage-rules/[id]',
    '/api/wage-rules',
    '/api/wages/calculate',
  ], 'wages.manage'),
  ...enterpriseRoutes([
    '/api/worker/me/wages',
  ], 'wages.read.self'),
  ...enterpriseRoutes([
    '/api/finance/orders/[id]/pricing',
    '/api/finance/orders',
    '/api/finance/wages/summary',
    '/api/finance/wages',
  ], 'finance.read', 'finance.manage'),
  ...enterpriseRoutes([
    '/api/finance/settlements',
  ], 'finance.read', 'wages.settle'),
  ...enterpriseRoutes([
    '/api/finance/wage-records/[id]/pay',
    '/api/finance/wage-records/[id]/settle',
  ], 'wages.settle'),
  ...enterpriseRoutes([
    '/api/settings/avatar',
    '/api/settings/check-prefix',
    '/api/settings/load',
    '/api/settings/password',
    '/api/settings/preferences',
    '/api/settings/profile',
    '/api/settings/save',
    '/api/settings/tenants',
    '/api/settings/verify-prefix',
  ], 'settings.read', 'settings.manage'),
];

export const API_ROUTE_POLICIES: Readonly<Record<string, ApiRoutePolicy>> = Object.freeze(
  Object.fromEntries(API_ROUTE_POLICY_ENTRIES),
);

function routePattern(path: string): RegExp {
  const escaped = path
    .split('/')
    .map((segment) => segment.startsWith('[') && segment.endsWith(']')
      ? '[^/]+'
      : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('/');
  return new RegExp(`^${escaped}$`);
}

const COMPILED_POLICIES = API_ROUTE_POLICY_ENTRIES.map(([path, policy]) => ({
  path,
  pattern: routePattern(path),
  policy,
  dynamicSegments: path.split('/').filter((segment) => segment.startsWith('[')).length,
})).sort((left, right) => (
  left.dynamicSegments - right.dynamicSegments
  || right.path.length - left.path.length
));

export function getApiRoutePolicy(pathname: string, method = 'GET'): (ApiRoutePolicy & {
  permission?: EnterprisePermissionCode;
  permissions?: readonly EnterprisePermissionCode[];
}) | null {
  const match = COMPILED_POLICIES.find((entry) => entry.pattern.test(pathname));
  if (!match) return null;
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  const permissions = isMutation
    ? match.policy.mutationPermissions ?? (match.policy.mutationPermission ? [match.policy.mutationPermission] : undefined)
    : match.policy.readPermissions ?? (match.policy.readPermission ? [match.policy.readPermission] : undefined);
  return {
    ...match.policy,
    permission: permissions?.[0],
    permissions,
  };
}
