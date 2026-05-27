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
  'special',
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

export const WAGE_RULE_SCOPE_TYPES = ['company', 'position', 'worker'] as const;
export type WageRuleScopeType = (typeof WAGE_RULE_SCOPE_TYPES)[number];

export const WAGE_RECORD_STATUS_VALUES = ['pending', 'approved', 'rejected', 'settled', 'paid'] as const;
export type WageRecordStatus = (typeof WAGE_RECORD_STATUS_VALUES)[number];

export const ORDER_STATUS_LOG_TARGETS = ['order', 'space', 'product', 'production_task', 'wage_record'] as const;
export type OrderStatusLogTarget = (typeof ORDER_STATUS_LOG_TARGETS)[number];

export interface WageTaskInput {
  quantity?: number | string | null;
  area?: number | string | null;
  length?: number | string | null;
  width?: number | string | null;
  meter_count?: number | string | null;
  task_type?: string | null;
  product_type?: string | null;
  process_name?: string | null;
  assigned_worker_id?: string | null;
  worker_id?: string | null;
}

export interface WageRuleInput {
  id?: string | null;
  unit_price?: number | string | null;
  calculation_method?: string | null;
  task_type?: string | null;
  process_name?: string | null;
  product_type?: string | null;
  scope_type?: string | null;
  worker_id?: string | null;
  position_id?: string | null;
  role_scope?: string | null;
  extra_amount?: number | string | null;
  enabled?: boolean | null;
  created_at?: string | null;
}

export interface WageWorkerMatchInput {
  id?: string | null;
  craft_type?: string | null;
  position_ids?: Array<string | null | undefined> | null;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeTokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeTokens(item));
  if (value && typeof value === 'object') return Object.values(value).flatMap((item) => normalizeTokens(item));
  return String(value ?? '')
    .split(/[,\s，、/|]+/)
    .map((item) => normalized(item))
    .filter(Boolean);
}

export function defaultWageCalculationMethod(taskType: string | null | undefined): WageCalculationMethod {
  const type = normalized(taskType);
  if (type === 'board') return 'by_area';
  if (type === 'door' || type === 'install' || type === 'delivery') return 'by_set';
  if (type === 'special') return 'fixed';
  return 'by_piece';
}

export function isWageRuleScopeType(value: string): value is WageRuleScopeType {
  return WAGE_RULE_SCOPE_TYPES.includes(value as WageRuleScopeType);
}

function squareArea(task: WageTaskInput): number {
  const explicitArea = toNumber(task.area);
  if (explicitArea > 0) return explicitArea;
  const length = toNumber(task.length);
  const width = toNumber(task.width);
  if (length <= 0 || width <= 0) return 0;
  const rawArea = length * width;
  return rawArea > 10000 ? rawArea / 1000000 : rawArea;
}

export function calculateTaskWage(task: WageTaskInput, wageRule: WageRuleInput | null | undefined): number {
  if (!wageRule) return 0;
  const unitPrice = toNumber(wageRule.unit_price);
  const extraAmount = toNumber(wageRule.extra_amount);
  const quantity = toNumber(task.quantity) || 1;
  const method = wageRule.calculation_method || defaultWageCalculationMethod(wageRule.task_type || task.task_type || task.product_type);

  if (method === 'fixed') return unitPrice + extraAmount;
  if (method === 'by_area') return squareArea(task) * unitPrice + extraAmount;
  if (method === 'by_meter') {
    const explicitMeters = toNumber(task.meter_count);
    const rawLength = toNumber(task.length);
    const meters = explicitMeters > 0 ? explicitMeters : rawLength > 100 ? rawLength / 1000 : rawLength;
    return meters * unitPrice + extraAmount;
  }
  return quantity * unitPrice + extraAmount;
}

function ruleScopeType(rule: WageRuleInput): WageRuleScopeType {
  if (rule.scope_type && isWageRuleScopeType(rule.scope_type)) return rule.scope_type;
  if (rule.worker_id) return 'worker';
  if (rule.position_id) return 'position';
  return 'company';
}

function ruleMatchesTask(rule: WageRuleInput, task: WageTaskInput, worker?: WageWorkerMatchInput | null): boolean {
  if (rule.enabled === false) return false;

  const taskType = normalized(task.task_type);
  const ruleTaskType = normalized(rule.task_type);
  if (ruleTaskType && taskType && ruleTaskType !== taskType) return false;

  const processName = normalized(task.process_name);
  const ruleProcessName = normalized(rule.process_name);
  if (ruleProcessName && ruleProcessName !== processName) return false;

  const productCandidates = [task.product_type, task.task_type].map(normalized).filter(Boolean);
  const ruleProductType = normalized(rule.product_type);
  if (ruleProductType && !productCandidates.includes(ruleProductType)) return false;

  const scopeType = ruleScopeType(rule);
  const workerId = normalized(worker?.id || task.assigned_worker_id || task.worker_id);
  if (scopeType === 'worker' && normalized(rule.worker_id) !== workerId) return false;

  const positionIds = new Set((worker?.position_ids || []).map(normalized).filter(Boolean));
  if (scopeType === 'position' && !positionIds.has(normalized(rule.position_id))) return false;

  const roleScopeTokens = normalizeTokens(rule.role_scope);
  if (roleScopeTokens.length > 0) {
    const workerTokens = normalizeTokens([worker?.craft_type, task.process_name, task.task_type, task.product_type]);
    if (!roleScopeTokens.some((token) => workerTokens.includes(token))) return false;
  }

  return true;
}

function wageRuleScore(rule: WageRuleInput, task: WageTaskInput): number {
  const scopeScore = ruleScopeType(rule) === 'worker' ? 300 : ruleScopeType(rule) === 'position' ? 200 : 100;
  const processScore = normalized(rule.process_name) ? 30 : 0;
  const productScore = normalized(rule.product_type) ? 20 : 0;
  const taskTypeScore = normalized(rule.task_type) === normalized(task.task_type) ? 10 : 0;
  const roleScopeScore = normalizeTokens(rule.role_scope).length > 0 ? 5 : 0;
  return scopeScore + processScore + productScore + taskTypeScore + roleScopeScore;
}

export function selectBestWageRuleForTask(
  rules: WageRuleInput[],
  task: WageTaskInput,
  worker?: WageWorkerMatchInput | null
): WageRuleInput | null {
  const matches = rules.filter((rule) => ruleMatchesTask(rule, task, worker));
  if (matches.length === 0) return null;
  return matches.sort((left, right) => {
    const scoreDiff = wageRuleScore(right, task) - wageRuleScore(left, task);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  })[0] || null;
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

export function canManageWageRules(user: AccessUser | null | undefined): boolean {
  return Boolean(user && isFactoryBoss(user));
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
