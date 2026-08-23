import type { EnterprisePermissionCode } from '@/lib/enterprise/permissions';

export type ApiRouteAccess = 'public' | 'authenticated' | 'enterprise' | 'development';

export interface ApiRoutePolicy {
  access: ApiRouteAccess;
  readPermission?: EnterprisePermissionCode;
  mutationPermission?: EnterprisePermissionCode;
}

type PolicyEntry = readonly [string, ApiRoutePolicy];

const publicRoutes = (paths: readonly string[]): PolicyEntry[] => paths.map((path) => [path, { access: 'public' }]);
const authenticatedRoutes = (paths: readonly string[]): PolicyEntry[] => paths.map((path) => [path, { access: 'authenticated' }]);
const developmentRoutes = (paths: readonly string[]): PolicyEntry[] => paths.map((path) => [path, { access: 'development' }]);
const enterpriseRoutes = (
  paths: readonly string[],
  readPermission: EnterprisePermissionCode,
  mutationPermission: EnterprisePermissionCode = readPermission,
): PolicyEntry[] => paths.map((path) => [path, { access: 'enterprise', readPermission, mutationPermission }]);

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
    '/api/order-exchanges/[id]',
    '/api/order-exchanges/partners',
    '/api/order-exchanges',
    '/api/order-partners',
    '/api/supplier/create',
    '/api/supplier/delete',
    '/api/supplier/list',
    '/api/supplier/orders',
    '/api/supplier/update',
  ], 'partners.read', 'partners.manage'),
  ...enterpriseRoutes([
    '/api/dealer/orders/[id]',
    '/api/dealer/orders/create',
    '/api/dealer/orders',
    '/api/factory/orders',
    '/api/orders/[id]',
    '/api/orders/[id]/spaces',
    '/api/orders/[id]/split/confirm',
    '/api/orders/attachments',
    '/api/orders/basic',
    '/api/orders/generate',
    '/api/orders/prefix',
    '/api/orders/sequence',
    '/api/orders',
    '/api/spaces/[id]/products',
    '/api/spaces/[id]',
  ], 'orders.read', 'orders.manage'),
  ...enterpriseRoutes([
    '/api/departments/[id]',
    '/api/departments',
    '/api/factory/workshops/[id]',
    '/api/factory/workshops',
    '/api/positions/[id]',
    '/api/positions',
  ], 'organization.read', 'organization.manage'),
  ...enterpriseRoutes([
    '/api/employees/[id]',
    '/api/employees',
    '/api/workers/[id]',
    '/api/workers/[id]/wages',
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
    '/api/notifications',
  ], 'notifications.read', 'notifications.manage'),
  ...enterpriseRoutes([
    '/api/tasks/[id]',
    '/api/tasks',
  ], 'tasks.read', 'tasks.manage'),
  ...enterpriseRoutes([
    '/api/performance/orders',
    '/api/performance/production',
    '/api/production/eligible-workers',
    '/api/production/tasks/[id]/abnormal',
    '/api/production/tasks/[id]/approve',
    '/api/production/tasks/[id]/assign',
    '/api/production/tasks/[id]/review',
    '/api/production/tasks/[id]/rework',
    '/api/production/tasks/[id]/start',
    '/api/production/tasks/[id]/submit',
    '/api/production/tasks/[id]',
    '/api/production/tasks',
    '/api/progress/logs',
    '/api/progress/report',
    '/api/progress/work-orders',
    '/api/progress/workshops',
    '/api/worker/me/tasks',
    '/api/worker/report',
    '/api/worker/tasks',
  ], 'production.read', 'production.manage'),
  ...enterpriseRoutes([
    '/api/products/[id]',
  ], 'orders.read', 'orders.update'),
  ...enterpriseRoutes([
    '/api/products/[id]/tasks',
  ], 'production.read', 'production.plan'),
  ...enterpriseRoutes([
    '/api/performance/workers/[id]',
    '/api/performance/workers',
    '/api/wage-records/[id]',
    '/api/wage-records',
    '/api/wage-rules/[id]',
    '/api/wage-rules',
    '/api/wages/calculate',
    '/api/worker/me/wages',
  ], 'wages.read.all', 'wages.manage'),
  ...enterpriseRoutes([
    '/api/finance/orders/[id]/pricing',
    '/api/finance/orders',
    '/api/finance/settlements',
    '/api/finance/wage-records/[id]/pay',
    '/api/finance/wage-records/[id]/settle',
    '/api/finance/wages/summary',
    '/api/finance/wages',
  ], 'finance.read', 'finance.manage'),
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
  pattern: routePattern(path),
  policy,
}));

export function getApiRoutePolicy(pathname: string, method = 'GET'): (ApiRoutePolicy & {
  permission?: EnterprisePermissionCode;
}) | null {
  const match = COMPILED_POLICIES.find((entry) => entry.pattern.test(pathname));
  if (!match) return null;
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  return {
    ...match.policy,
    permission: isMutation ? match.policy.mutationPermission : match.policy.readPermission,
  };
}
