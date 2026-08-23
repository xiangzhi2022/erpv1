import {
  categories,
  customers,
  dealers,
  departments,
  employeePositions,
  employeeRoles,
  employees,
  enterpriseJoinRequests,
  factoryWorkshops,
  notifications,
  orderExchanges,
  orderItemAttachments,
  orderItems,
  orderModules,
  orderPrefixes,
  orderProducts,
  orders,
  orderSpaces,
  orderStatusLogs,
  positions,
  productionTasks,
  profiles,
  progressLogs,
  suppliers,
  tasks,
  userSettings,
  wageRules,
  workOrders,
  workerWageRecords,
  workers,
} from './erp-schema';
import {
  organizationWorkshops,
  rolePermissions,
  roles,
} from './v2-schema';

export * from './erp-schema';
export {
  apiIdempotencyKeys,
  auditEvents,
  enterpriseMemberships,
  enterprises,
  identityActionRequests,
  orgUnits,
  organizationWorkshops,
  organizationWorkshops as workshops,
  permissionCatalog,
  roleBindingSites,
  roleBindingWorkshops,
  roleBindings,
  rolePermissions,
  roles,
  securityEvents,
  sites,
  workstations,
} from './v2-schema';

export type Profile = typeof profiles.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type EmployeePosition = typeof employeePositions.$inferSelect;
export type EmployeeRole = typeof employeeRoles.$inferSelect;
export type EnterpriseJoinRequest = typeof enterpriseJoinRequests.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderSpace = typeof orderSpaces.$inferSelect;
export type OrderProduct = typeof orderProducts.$inferSelect;
export type OrderModule = typeof orderModules.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderItemAttachment = typeof orderItemAttachments.$inferSelect;
export type OrderPrefix = typeof orderPrefixes.$inferSelect;
export type OrderExchange = typeof orderExchanges.$inferSelect;
export type Workshop = typeof organizationWorkshops.$inferSelect;
export type FactoryWorkshop = typeof factoryWorkshops.$inferSelect;
export type ProductionTask = typeof productionTasks.$inferSelect;
export type WageRule = typeof wageRules.$inferSelect;
export type WorkerWageRecord = typeof workerWageRecords.$inferSelect;
export type OrderStatusLog = typeof orderStatusLogs.$inferSelect;
export type WorkOrder = typeof workOrders.$inferSelect;
export type ProgressLog = typeof progressLogs.$inferSelect;
export type Worker = typeof workers.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Dealer = typeof dealers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserSetting = typeof userSettings.$inferSelect;

export type InsertCategory = Pick<Category, 'name' | 'color' | 'description'>;
export type InsertTask = Pick<
  Task,
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'category_id'
  | 'assignee_id'
  | 'assignee_name'
  | 'assignee_avatar'
  | 'completed'
>;
export type InsertNotification = Pick<
  Notification,
  'task_id' | 'type' | 'title' | 'message'
>;
