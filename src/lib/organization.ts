import type { AccessUser, PermissionKey } from '@/lib/role-access';
import { getPermissionTemplate, getUserPermissionKeys } from '@/lib/role-access';

export interface DefaultDepartment {
  code: string;
  name: string;
  sort_order: number;
}

export interface DefaultRole {
  code: string;
  name: string;
  description: string;
}

export interface DefaultPosition {
  code: string;
  name: string;
  department_code: string;
  position_type: string;
  can_receive_production_task: boolean;
  can_calculate_piece_wage: boolean;
  can_review_task: boolean;
  can_assign_task: boolean;
  default_role_code: string;
}

export interface EmployeeLike {
  id?: string;
  role?: string;
  permissions?: string[];
  roles?: Array<string | { code?: string | null }>;
  positions?: Array<{
    code?: string | null;
    can_receive_production_task?: boolean | null;
    can_calculate_piece_wage?: boolean | null;
    can_review_task?: boolean | null;
    can_assign_task?: boolean | null;
  }>;
  primary_position?: {
    code?: string | null;
    can_receive_production_task?: boolean | null;
    can_calculate_piece_wage?: boolean | null;
    can_review_task?: boolean | null;
    can_assign_task?: boolean | null;
  } | null;
}

export const DEFAULT_DEPARTMENTS: DefaultDepartment[] = [
  { code: 'management', name: '管理层', sort_order: 10 },
  { code: 'production', name: '生产部', sort_order: 20 },
  { code: 'finance', name: '财务部', sort_order: 30 },
  { code: 'business', name: '业务部', sort_order: 40 },
  { code: 'warehouse', name: '仓储部', sort_order: 50 },
  { code: 'administration', name: '行政部', sort_order: 60 },
  { code: 'quality', name: '质检部', sort_order: 70 },
  { code: 'delivery', name: '发货部', sort_order: 80 },
];

export const DEFAULT_ROLES: DefaultRole[] = [
  { code: 'admin', name: '管理员', description: '系统管理' },
  { code: 'boss', name: '老板', description: '查看和管理全部业务' },
  { code: 'production_manager', name: '生产主管', description: '生产任务分配和审核' },
  { code: 'worker', name: '工人', description: '个人生产任务和工资' },
  { code: 'finance', name: '财务', description: '财务和工资结算' },
  { code: 'data_entry', name: '录入员', description: '订单基础资料录入' },
  { code: 'dealer', name: '经销商', description: '经销商订单跟踪' },
  { code: 'warehouse', name: '仓库', description: '仓储管理' },
  { code: 'quality_inspector', name: '质检员', description: '质检任务' },
  { code: 'delivery_staff', name: '发货员', description: '发货管理' },
  { code: 'business_staff', name: '业务员', description: '业务订单' },
];

export const DEFAULT_POSITIONS: DefaultPosition[] = [
  { code: 'cutting_worker', name: '开料工', department_code: 'production', position_type: 'production_worker', can_receive_production_task: true, can_calculate_piece_wage: true, can_review_task: false, can_assign_task: false, default_role_code: 'worker' },
  { code: 'edge_banding_worker', name: '封边工', department_code: 'production', position_type: 'production_worker', can_receive_production_task: true, can_calculate_piece_wage: true, can_review_task: false, can_assign_task: false, default_role_code: 'worker' },
  { code: 'drilling_worker', name: '打孔工', department_code: 'production', position_type: 'production_worker', can_receive_production_task: true, can_calculate_piece_wage: true, can_review_task: false, can_assign_task: false, default_role_code: 'worker' },
  { code: 'assembly_worker', name: '组装工', department_code: 'production', position_type: 'production_worker', can_receive_production_task: true, can_calculate_piece_wage: true, can_review_task: false, can_assign_task: false, default_role_code: 'worker' },
  { code: 'installation_worker', name: '安装工', department_code: 'production', position_type: 'production_worker', can_receive_production_task: true, can_calculate_piece_wage: true, can_review_task: false, can_assign_task: false, default_role_code: 'worker' },
  { code: 'packaging_worker', name: '包装工', department_code: 'production', position_type: 'production_worker', can_receive_production_task: true, can_calculate_piece_wage: true, can_review_task: false, can_assign_task: false, default_role_code: 'worker' },
  { code: 'production_manager', name: '生产主管', department_code: 'production', position_type: 'production_manager', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: true, can_assign_task: true, default_role_code: 'production_manager' },
  { code: 'workshop_director', name: '车间主任', department_code: 'production', position_type: 'production_manager', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: true, can_assign_task: true, default_role_code: 'production_manager' },
  { code: 'scheduler', name: '排产员', department_code: 'production', position_type: 'production_manager', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: false, can_assign_task: true, default_role_code: 'production_manager' },
  { code: 'team_leader', name: '组长', department_code: 'production', position_type: 'production_manager', can_receive_production_task: true, can_calculate_piece_wage: true, can_review_task: true, can_assign_task: true, default_role_code: 'production_manager' },
  { code: 'quality_inspector', name: '质检员', department_code: 'quality', position_type: 'quality', can_receive_production_task: true, can_calculate_piece_wage: false, can_review_task: true, can_assign_task: false, default_role_code: 'quality_inspector' },
  { code: 'finance_staff', name: '财务', department_code: 'finance', position_type: 'finance', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: false, can_assign_task: false, default_role_code: 'finance' },
  { code: 'data_entry', name: '录入员', department_code: 'administration', position_type: 'data_entry', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: false, can_assign_task: false, default_role_code: 'data_entry' },
  { code: 'warehouse_keeper', name: '仓库管理员', department_code: 'warehouse', position_type: 'warehouse', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: false, can_assign_task: false, default_role_code: 'warehouse' },
  { code: 'delivery_staff', name: '发货员', department_code: 'delivery', position_type: 'delivery', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: false, can_assign_task: false, default_role_code: 'delivery_staff' },
  { code: 'purchaser', name: '采购', department_code: 'business', position_type: 'purchasing', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: false, can_assign_task: false, default_role_code: 'business_staff' },
  { code: 'customer_service', name: '客服', department_code: 'business', position_type: 'service', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: false, can_assign_task: false, default_role_code: 'business_staff' },
  { code: 'boss', name: '老板', department_code: 'management', position_type: 'management', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: true, can_assign_task: true, default_role_code: 'boss' },
  { code: 'system_admin', name: '系统管理员', department_code: 'management', position_type: 'admin', can_receive_production_task: false, can_calculate_piece_wage: false, can_review_task: true, can_assign_task: true, default_role_code: 'admin' },
];

export const ROLE_TO_PERMISSION_KEYS: Record<string, PermissionKey[]> = {
  admin: ['factory_boss'],
  boss: ['factory_boss'],
  production_manager: ['factory_production_manager'],
  worker: ['factory_worker'],
  finance: ['factory_finance', 'factory_profit_view'],
  data_entry: ['factory_data_entry'],
  dealer: ['dealer_order_tracker'],
  warehouse: ['factory_shipping'],
  quality_inspector: ['factory_quality'],
  delivery_staff: ['factory_shipping'],
  business_staff: ['factory_sales'],
};

export function defaultPermissionsForRole(roleCode: string): PermissionKey[] {
  return ROLE_TO_PERMISSION_KEYS[roleCode] || [];
}

export function normalizeRoleCodes(value: EmployeeLike | AccessUser | null | undefined): string[] {
  if (!value) return [];
  const directRole = typeof value.role === 'string' ? [value.role] : [];
  const relationRoles = (value as EmployeeLike).roles || [];
  return Array.from(new Set([
    ...directRole,
    ...relationRoles.map((role) => (typeof role === 'string' ? role : role.code || '')).filter(Boolean),
  ]));
}

export function hasRole(userOrEmployee: EmployeeLike | AccessUser | null | undefined, roleCode: string): boolean {
  if (!userOrEmployee) return false;
  const roles = normalizeRoleCodes(userOrEmployee);
  if (roles.includes(roleCode)) return true;
  return getEmployeeEffectiveRoles(userOrEmployee).includes(roleCode);
}

export function hasPermission(userOrEmployee: EmployeeLike | AccessUser | null | undefined, permissionCode: string): boolean {
  if (!userOrEmployee) return false;
  if ((userOrEmployee.permissions || []).includes(permissionCode)) return true;
  if (getPermissionTemplate(permissionCode)) {
    return getUserPermissionKeys(userOrEmployee as AccessUser).includes(permissionCode as PermissionKey);
  }
  return getEmployeeEffectivePermissions(userOrEmployee).includes(permissionCode);
}

export function getEmployeeEffectiveRoles(employee: EmployeeLike | AccessUser | null | undefined): string[] {
  if (!employee) return [];
  const employeeLike = employee as EmployeeLike;
  const roleCodes = normalizeRoleCodes(employee);
  const positionRoles = [
    employeeLike.primary_position?.code,
    ...(employeeLike.positions || []).map((position: NonNullable<EmployeeLike['positions']>[number]) => position.code),
  ].filter((code): code is string => Boolean(code));
  return Array.from(new Set([...roleCodes, ...positionRoles]));
}

export function getEmployeeEffectivePermissions(employee: EmployeeLike | AccessUser | null | undefined): string[] {
  if (!employee) return [];
  const direct = employee.permissions || [];
  const byRoles = getEmployeeEffectiveRoles(employee).flatMap(defaultPermissionsForRole);
  const accessPermissions = getUserPermissionKeys(employee as AccessUser);
  return Array.from(new Set([...direct, ...byRoles, ...accessPermissions]));
}

function anyPositionFlag(employee: EmployeeLike | null | undefined, flag: 'can_receive_production_task' | 'can_calculate_piece_wage' | 'can_review_task' | 'can_assign_task'): boolean {
  if (!employee) return false;
  const positions = [employee.primary_position, ...(employee.positions || [])].filter(Boolean);
  return positions.some((position) => position?.[flag] === true);
}

export function canReceiveProductionTask(employee: EmployeeLike | AccessUser | null | undefined): boolean {
  return anyPositionFlag(employee as EmployeeLike, 'can_receive_production_task') || hasPermission(employee, 'factory_worker');
}

export function canCalculatePieceWage(employee: EmployeeLike | AccessUser | null | undefined): boolean {
  return anyPositionFlag(employee as EmployeeLike, 'can_calculate_piece_wage') || hasPermission(employee, 'factory_worker');
}

export function canReviewProductionTask(employee: EmployeeLike | AccessUser | null | undefined): boolean {
  return anyPositionFlag(employee as EmployeeLike, 'can_review_task') || hasPermission(employee, 'factory_production_manager') || hasPermission(employee, 'factory_boss');
}

export function canAssignProductionTask(employee: EmployeeLike | AccessUser | null | undefined): boolean {
  return anyPositionFlag(employee as EmployeeLike, 'can_assign_task') || hasPermission(employee, 'factory_production_manager') || hasPermission(employee, 'factory_boss');
}

export function filterEmployeesForTask<T extends EmployeeLike>(task: unknown, employees: T[]): T[] {
  void task;
  return employees.filter((employee) => canReceiveProductionTask(employee));
}
