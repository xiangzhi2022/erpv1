import {
  canAccessPath,
  getUserPermissionKeys,
  isAdminRole,
  isSuperAdmin,
  type AccessUser,
  type PermissionKey,
} from '@/lib/role-access';
import {
  canViewFinancialFields,
  canViewInternalProduction,
  canViewWageSummary,
  externalDealerStatus,
  isDealerSide,
  isWorkerOnly,
} from '@/lib/four-level-order';
import { hasPermission, hasRole } from '@/lib/organization';

export { hasPermission, hasRole };

export const PRICE_FIELDS = [
  'total_amount',
  'sale_price',
  'cost_price',
  'cost_amount',
  'material_cost',
  'hardware_cost',
  'labor_cost',
  'profit',
  'profit_amount',
  'purchase_price',
  'supplier_price',
  'quoted_amount',
] as const;

export const WAGE_FIELDS = [
  'wage_rule_id',
  'unit_price',
  'estimated_wage_amount',
  'final_wage_amount',
  'worker_wage_records',
  'other_worker_wages',
] as const;

export const INTERNAL_FIELDS = [
  'internal_remark',
  'finance_remark',
  'production_internal_note',
  'supplier_price',
  'assigned_worker_id',
  'worker_id',
  'worker',
] as const;

const FIELD_PERMISSION_CODES: Record<string, string> = {
  total_amount: 'finance.view',
  sale_price: 'finance.view',
  cost_price: 'finance.view',
  cost_amount: 'finance.view',
  material_cost: 'finance.view',
  hardware_cost: 'finance.view',
  labor_cost: 'finance.view',
  profit: 'finance.profit.view',
  profit_amount: 'finance.profit.view',
  purchase_price: 'finance.view',
  supplier_price: 'finance.view',
  unit_price: 'wage.rule.view',
  estimated_wage_amount: 'wage.summary.view',
  final_wage_amount: 'wage.summary.view',
};

export function mapInternalStatusToDealerStatus(status: string | null | undefined): string {
  return externalDealerStatus(status);
}

export function canAccessRoute(userOrEmployee: AccessUser | null | undefined, route: string): boolean {
  return canAccessPath(userOrEmployee, route);
}

export function canViewField(userOrEmployee: AccessUser | null | undefined, fieldCode: string): boolean {
  if (!userOrEmployee) return false;
  if (isSuperAdmin(userOrEmployee) || isAdminRole(userOrEmployee)) return true;
  if (PRICE_FIELDS.includes(fieldCode as (typeof PRICE_FIELDS)[number])) return canViewFinancialFields(userOrEmployee);
  if (WAGE_FIELDS.includes(fieldCode as (typeof WAGE_FIELDS)[number])) return canViewWageSummary(userOrEmployee);
  if (INTERNAL_FIELDS.includes(fieldCode as (typeof INTERNAL_FIELDS)[number])) return canViewInternalProduction(userOrEmployee);
  const permissionCode = FIELD_PERMISSION_CODES[fieldCode];
  return permissionCode ? hasPermission(userOrEmployee, permissionCode) : true;
}

function clonePlain<T>(data: T): T {
  if (Array.isArray(data)) return data.map((item) => clonePlain(item)) as T;
  if (data && typeof data === 'object') return { ...(data as Record<string, unknown>) } as T;
  return data;
}

export function filterSensitiveFields<T>(data: T, userOrEmployee: AccessUser | null | undefined): T {
  if (Array.isArray(data)) return data.map((item) => filterSensitiveFields(item, userOrEmployee)) as T;
  if (!data || typeof data !== 'object') return data;

  const copy = clonePlain(data) as Record<string, unknown>;
  for (const key of [...PRICE_FIELDS, ...WAGE_FIELDS, ...INTERNAL_FIELDS]) {
    if (!canViewField(userOrEmployee, key)) delete copy[key];
  }
  for (const [key, value] of Object.entries(copy)) {
    if (Array.isArray(value)) copy[key] = value.map((item) => filterSensitiveFields(item, userOrEmployee));
    else if (value && typeof value === 'object') copy[key] = filterSensitiveFields(value, userOrEmployee);
  }
  return copy as T;
}

export function filterOrderForRole<T extends Record<string, unknown>>(order: T, roleOrUser: string | AccessUser): T {
  const user: AccessUser = typeof roleOrUser === 'string' ? { role: 'employee', permissions: rolePermissions(roleOrUser) } : roleOrUser;
  const copy = filterSensitiveFields(order, user);
  if (isDealerSide(user)) {
    delete (copy as Record<string, unknown>).spaces;
    delete (copy as Record<string, unknown>).production_tasks;
    (copy as Record<string, unknown>).external_status = mapInternalStatusToDealerStatus(String(order.status || ''));
  }
  return copy;
}

export function filterTaskForRole<T extends Record<string, unknown>>(task: T, roleOrUser: string | AccessUser): T {
  const user: AccessUser = typeof roleOrUser === 'string' ? { role: 'employee', permissions: rolePermissions(roleOrUser) } : roleOrUser;
  const copy = filterSensitiveFields(task, user);
  if (isWorkerOnly(user) || isDealerSide(user)) {
    delete (copy as Record<string, unknown>).worker;
    delete (copy as Record<string, unknown>).assigned_worker_id;
    delete (copy as Record<string, unknown>).worker_id;
  }
  return copy;
}

export function filterWageForRole<T extends Record<string, unknown>>(wageRecord: T, roleOrUser: string | AccessUser): T {
  const user: AccessUser = typeof roleOrUser === 'string' ? { role: 'employee', permissions: rolePermissions(roleOrUser) } : roleOrUser;
  if (canViewWageSummary(user)) return wageRecord;
  const copy = { ...wageRecord };
  delete copy.unit_price;
  delete copy.wage_rule_id;
  return copy;
}

function rolePermissions(role: string): PermissionKey[] {
  if (role === 'boss' || role === 'admin') return ['factory_boss'];
  if (role === 'production_manager') return ['factory_production_manager'];
  if (role === 'worker') return ['factory_worker'];
  if (role === 'dealer') return ['dealer_order_tracker'];
  if (role === 'finance') return ['factory_finance', 'factory_profit_view'];
  if (role === 'data_entry') return ['factory_data_entry'];
  return getUserPermissionKeys({ role } as AccessUser);
}
