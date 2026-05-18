import { z } from 'zod';
import type { OrderFlow, OrderMode } from '@/lib/order-flow';

export const ORDER_STATUSES = [
  'pending',
  'returned',
  'confirmed',
  'pool',
  'producing',
  'shipped',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; dotColor: string }> = {
  pending: { label: '待接收', color: 'bg-orange-100 text-orange-700 border-orange-200', dotColor: 'bg-orange-500' },
  returned: { label: '已退回', color: 'bg-red-100 text-red-700 border-red-200', dotColor: 'bg-red-500' },
  confirmed: { label: '已接收', color: 'bg-blue-100 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' },
  pool: { label: '订单池', color: 'bg-purple-100 text-purple-700 border-purple-200', dotColor: 'bg-purple-500' },
  producing: { label: '生产中', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dotColor: 'bg-yellow-500' },
  shipped: { label: '已发货', color: 'bg-green-100 text-green-700 border-green-200', dotColor: 'bg-green-500' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-700 border-gray-200', dotColor: 'bg-gray-500' },
};

export const STATUS_TRANSITIONS: Record<string, Set<string>> = {
  pending: new Set(['confirmed', 'returned', 'cancelled']),
  returned: new Set(['pending', 'cancelled']),
  confirmed: new Set(['pool', 'cancelled']),
  pool: new Set(['producing', 'cancelled']),
  producing: new Set(['shipped', 'cancelled']),
  shipped: new Set(['completed']),
  completed: new Set(),
  cancelled: new Set(),
};

export const ORDER_TABS = [
  { value: 'all', label: '全部订单', statuses: [] as string[] },
  { value: 'pending', label: '待接收', statuses: ['pending'] },
  { value: 'confirmed', label: '已接收', statuses: ['confirmed'] },
  { value: 'producing', label: '生产中', statuses: ['producing', 'pool'] },
  { value: 'shipped', label: '已发货', statuses: ['shipped'] },
  { value: 'completed', label: '已完成', statuses: ['completed'] },
] as const;

export const ORDER_MODULE_PRESETS = ['主卧室', '厨房', '次卧', '客房', '书房', '阳台', '玄关', '客厅'] as const;
export const WOODWORKING_CRAFT_OPTIONS = ['免拉手', '钉装柜', '拆装柜', '拆装五金', '铁件'] as const;
export const FORMING_CRAFT_OPTIONS = ['冷压制', '木皮方向长边', '木皮方向短边'] as const;
export const PAINTING_CRAFT_OPTIONS = ['混油', '贴皮'] as const;
export const CONSTRUCTION_SURFACE_OPTIONS = ['一面四边', '一面两长边'] as const;
export const ORDER_UNITS = ['件', '套', '米', '平方米', '块', '个'] as const;
export const PRODUCTION_TASK_TYPES = ['board', 'door', 'hardware', 'process', 'install', 'package', 'delivery'] as const;

const optionalNumber = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().min(0, '不能为负数').optional()
);

export const orderAttachmentSchema = z.object({
  file_name: z.string().min(1, '文件名不能为空'),
  file_path: z.string().min(1, '文件路径不能为空'),
  file_url: z.string().min(1, '文件地址不能为空'),
  file_type: z.string().optional().nullable(),
  file_size: z.coerce.number().int().min(0).optional().nullable(),
});

export const productionTaskDraftSchema = z.object({
  task_type: z.enum(PRODUCTION_TASK_TYPES),
  task_name: z.string().min(1, '拆单任务名称不能为空'),
  task_code: z.string().optional().default(''),
  quantity: z.coerce.number().min(0.01, '数量必须大于0'),
  unit: z.string().min(1, '单位不能为空'),
  length_mm: optionalNumber,
  width_mm: optionalNumber,
  thickness_mm: optionalNumber,
  area: optionalNumber,
  material: z.string().optional().default(''),
  color: z.string().optional().default(''),
  process_name: z.string().optional().default(''),
  construction_surface: z.string().optional().default(''),
  hardware: z.string().optional().default(''),
  hardware_quantity: optionalNumber,
  remark: z.string().optional().default(''),
  attachments: z.array(orderAttachmentSchema).default([]),
});

export const orderItemSchema = z.object({
  product_name: z.string().min(1, '产品名称不能为空'),
  product_type: z.string().optional().default('custom'),
  specification: z.string().optional().default(''),
  material: z.string().optional().default(''),
  woodworking_craft: z.string().optional().default(''),
  forming_craft: z.string().optional().default(''),
  painting_craft: z.string().optional().default(''),
  length_mm: optionalNumber,
  width_mm: optionalNumber,
  thickness_mm: optionalNumber,
  quantity: z.coerce.number().int('数量必须为整数').min(1, '数量必须大于0'),
  unit: z.string().min(1, '单位不能为空'),
  color: z.string().optional().default(''),
  hardware: z.string().optional().default(''),
  hardware_quantity: optionalNumber,
  construction_surface: z.string().optional().default(''),
  unit_price: z.coerce.number().min(0, '单价不能为负数'),
  remark: z.string().optional().default(''),
  attachments: z.array(orderAttachmentSchema).default([]),
  tasks: z.array(productionTaskDraftSchema).default([]),
});

export const orderModuleSchema = z.object({
  module_name: z.string().min(1, '二级模块名称不能为空'),
  remark: z.string().optional().default(''),
  items: z.array(orderItemSchema).min(1, '每个模块至少需要一个产品明细'),
});

export const orderFormSchema = z.object({
  order_no: z.string().min(1, '订单编号不能为空'),
  order_flow: z.enum(['dealer_to_factory', 'factory_to_supplier']),
  to_tenant_id: z.string().min(1, '请选择接收企业'),
  target_factory_id: z.string().optional().default(''),
  parent_order_id: z.string().optional().default(''),
  customer_name: z.string().min(1, '接收企业不能为空'),
  customer_phone: z.string().optional().default(''),
  customer_address: z.string().optional().default(''),
  delivery_date: z.string().optional().default(''),
  remark: z.string().optional().default(''),
  modules: z.array(orderModuleSchema).min(1, '至少需要一个二级模块'),
});

export type OrderAttachmentFormValues = z.infer<typeof orderAttachmentSchema>;
export type ProductionTaskDraftFormValues = z.infer<typeof productionTaskDraftSchema>;
export type OrderItemFormValues = z.infer<typeof orderItemSchema>;
export type OrderModuleFormValues = z.infer<typeof orderModuleSchema>;
export type OrderFormValues = z.infer<typeof orderFormSchema>;

export interface TenantOption {
  id: string;
  name: string | null;
  company_name?: string | null;
  tenant_type?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  status?: string | null;
}

export type FactoryEnterprise = TenantOption & {
  current_load?: number;
  max_load?: number;
  load_percentage?: number;
};

export interface OrderItemAttachment {
  id: string;
  order_id: string;
  module_id: string | null;
  order_item_id: string;
  tenant_id: string | null;
  file_name: string;
  file_path: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  module_id: string | null;
  item_no: string | null;
  product_name: string;
  specifications: string | null;
  woodworking_craft: string | null;
  forming_craft: string | null;
  painting_craft: string | null;
  length_mm: number | string | null;
  width_mm: number | string | null;
  thickness_mm: number | string | null;
  quantity: number | string;
  unit: string | null;
  color: string | null;
  hardware: string | null;
  hardware_quantity: number | string | null;
  construction_surface: string | null;
  unit_price: number | string;
  subtotal: number | string;
  remark: string | null;
  sort_order?: number | null;
  created_at: string;
  updated_at?: string | null;
  attachments?: OrderItemAttachment[];
}

export interface OrderModule {
  id: string;
  order_id: string;
  module_no: string;
  module_name: string;
  sort_order: number;
  remark: string | null;
  created_at: string;
  updated_at: string | null;
  items: OrderItem[];
  attachments?: OrderItemAttachment[];
}

export interface Order {
  id: string;
  order_no: string;
  tenant_id: string | null;
  target_factory_id: string | null;
  dealer_id: string | null;
  order_flow: OrderFlow | null;
  from_tenant_id: string | null;
  to_tenant_id: string | null;
  parent_order_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  total_amount: number | string | null;
  delivery_date: string | null;
  remark: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string | null;
  items: OrderItem[];
  modules: OrderModule[];
  from_tenant?: TenantOption | null;
  to_tenant?: TenantOption | null;
  parent_order?: Pick<Order, 'id' | 'order_no' | 'customer_name'> | null;
}

export interface OrderStats {
  total: number;
  pending: number;
  returned: number;
  confirmed: number;
  pool: number;
  producing: number;
  shipped: number;
  completed: number;
  cancelled: number;
}

export interface OrderPageContext {
  mode: OrderMode;
  visibleModes: OrderMode[];
  canCreate: boolean;
  title: string;
  description: string;
  createLabel: string | null;
  partnerLabel: string | null;
}

export function formatAmount(amount: number | string | null | undefined): string {
  const value = typeof amount === 'string' ? Number(amount) : amount ?? 0;
  return (Number.isFinite(value) ? value / 100 : 0).toFixed(2);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
