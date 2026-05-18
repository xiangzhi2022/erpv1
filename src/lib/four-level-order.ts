import type { AccessUser, PermissionKey } from '@/lib/role-access';
import { getUserPermissionKeys, isAdminRole, isSuperAdmin } from '@/lib/role-access';

export const ORDER_STATUS_VALUES = [
  'draft',
  'pending',
  'submitted',
  'reviewed',
  'confirmed',
  'pool',
  'accepted',
  'producing',
  'partially_completed',
  'ready_to_ship',
  'shipped',
  'completed',
  'cancelled',
  'returned',
  'abnormal',
] as const;

export type FourLevelOrderStatus = (typeof ORDER_STATUS_VALUES)[number];

export const PRODUCTION_TASK_TYPES = [
  'board',
  'door',
  'hardware',
  'process',
  'install',
  'package',
  'delivery',
] as const;

export type ProductionTaskType = (typeof PRODUCTION_TASK_TYPES)[number];

export const PRODUCTION_TASK_STATUS_VALUES = [
  'pending_generate',
  'pending_assign',
  'assigned',
  'pending_start',
  'producing',
  'submitted',
  'pending_quality_check',
  'quality_passed',
  'quality_failed',
  'reworking',
  'completed',
  'cancelled',
  'abnormal',
] as const;

export type ProductionTaskStatus = (typeof PRODUCTION_TASK_STATUS_VALUES)[number];

export const WAGE_CALCULATION_METHODS = [
  'by_piece',
  'by_area',
  'by_meter',
  'by_set',
  'fixed',
] as const;

export type WageCalculationMethod = (typeof WAGE_CALCULATION_METHODS)[number];

export const WAGE_RECORD_STATUS_VALUES = ['pending', 'approved', 'rejected', 'settled', 'paid'] as const;
export type WageRecordStatus = (typeof WAGE_RECORD_STATUS_VALUES)[number];

export const ORDER_STATUS_LOG_TARGETS = ['order', 'space', 'product', 'production_task', 'wage_record'] as const;
export type OrderStatusLogTarget = (typeof ORDER_STATUS_LOG_TARGETS)[number];

export interface WageTaskInput {
  quantity?: number | string | null;
  area?: number | string | null;
  length?: number | string | null;
  meter_count?: number | string | null;
}

export interface WageRuleInput {
  unit_price?: number | string | null;
  calculation_method?: string | null;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateTaskWage(task: WageTaskInput, wageRule: WageRuleInput | null | undefined): number {
  if (!wageRule) return 0;
  const unitPrice = toNumber(wageRule.unit_price);
  const quantity = toNumber(task.quantity) || 1;
  const method = wageRule.calculation_method || 'by_piece';

  if (method === 'fixed') return unitPrice;
  if (method === 'by_area') return toNumber(task.area) * unitPrice;
  if (method === 'by_meter') {
    const explicitMeters = toNumber(task.meter_count);
    const rawLength = toNumber(task.length);
    const meters = explicitMeters > 0 ? explicitMeters : rawLength > 100 ? rawLength / 1000 : rawLength;
    return meters * unitPrice;
  }
  return quantity * unitPrice;
}

export function isProductionTaskStatus(value: string): value is ProductionTaskStatus {
  return PRODUCTION_TASK_STATUS_VALUES.includes(value as ProductionTaskStatus);
}

export function isWageCalculationMethod(value: string): value is WageCalculationMethod {
  return WAGE_CALCULATION_METHODS.includes(value as WageCalculationMethod);
}

export function isProductionTaskType(value: string): value is ProductionTaskType {
  return PRODUCTION_TASK_TYPES.includes(value as ProductionTaskType);
}

export function externalDealerStatus(status: string | null | undefined): string {
  if (!status) return '订单已接收';
  if (status === 'accepted' || status === 'reviewed' || status === 'submitted') return '订单已接收';
  if (status === 'pending_assign' || status === 'assigned') return '已排产';
  if (status === 'producing' || status === 'partially_completed' || status === 'reworking') return '生产中';
  if (status === 'pending_quality_check') return '质检中';
  if (status === 'quality_passed') return '生产完成';
  if (status === 'ready_to_ship') return '待发货';
  if (status === 'shipped') return '已发货';
  if (status === 'completed') return '已完成';
  if (status === 'abnormal' || status === 'quality_failed') return '订单异常';
  return '订单已接收';
}

export function mapInternalStatusToDealerStatus(status: string | null | undefined): string {
  return externalDealerStatus(status);
}

export function hasAnyPermission(user: AccessUser | null | undefined, keys: readonly PermissionKey[]): boolean {
  const permissions = getUserPermissionKeys(user);
  return keys.some((key) => permissions.includes(key));
}

export function isFactoryBoss(user: AccessUser | null | undefined): boolean {
  return Boolean(
    user &&
      (isSuperAdmin(user) ||
        user.role === 'factory_admin' ||
        hasAnyPermission(user, ['factory_boss']))
  );
}

export function canManageProduction(user: AccessUser | null | undefined): boolean {
  return Boolean(
    user &&
      (isFactoryBoss(user) ||
        hasAnyPermission(user, ['factory_production_manager', 'factory_order_manager']))
  );
}

export function canOperateWorkerTask(user: AccessUser | null | undefined): boolean {
  return Boolean(
    user &&
      (canManageProduction(user) ||
        hasAnyPermission(user, [
          'factory_worker',
          'factory_carpenter',
          'factory_polisher',
          'factory_veneer',
          'factory_painter',
          'factory_quality',
          'factory_packer',
          'factory_general_worker',
        ]))
  );
}

export function canManageWages(user: AccessUser | null | undefined): boolean {
  return Boolean(user && (isFactoryBoss(user) || hasAnyPermission(user, ['factory_production_manager'])));
}

export function canViewWageSummary(user: AccessUser | null | undefined): boolean {
  return Boolean(
    user &&
      (canManageWages(user) ||
        hasAnyPermission(user, ['factory_finance']))
  );
}

export function canViewFinancialFields(user: AccessUser | null | undefined): boolean {
  return Boolean(
    user &&
      (isFactoryBoss(user) ||
        hasAnyPermission(user, ['factory_finance', 'factory_profit_view', 'dealer_accounting']))
  );
}

export function canEditFinancialFields(user: AccessUser | null | undefined): boolean {
  return Boolean(user && (isFactoryBoss(user) || hasAnyPermission(user, ['factory_finance'])));
}

export function canEditOrderContent(user: AccessUser | null | undefined): boolean {
  return Boolean(
    user &&
      (isFactoryBoss(user) ||
        canManageProduction(user) ||
        hasAnyPermission(user, ['factory_data_entry', 'factory_order_manager', 'dealer_order_entry', 'dealer_order_submitter']))
  );
}

export function canViewInternalProduction(user: AccessUser | null | undefined): boolean {
  return Boolean(
    user &&
      (isFactoryBoss(user) ||
        canManageProduction(user) ||
        hasAnyPermission(user, ['factory_data_entry', 'factory_finance', 'factory_shipping']))
  );
}

export function isDealerSide(user: AccessUser | null | undefined): boolean {
  return Boolean(user && (user.role === 'dealer_admin' || user.tenant_type === 'dealer' || hasAnyPermission(user, ['dealer_order_entry', 'dealer_accounting', 'dealer_order_submitter', 'dealer_order_tracker'])));
}

export function isWorkerOnly(user: AccessUser | null | undefined): boolean {
  return Boolean(user && !isAdminRole(user) && canOperateWorkerTask(user) && !canManageProduction(user));
}
