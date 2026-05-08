import { z } from 'zod';

// Order status configuration
export const ORDER_STATUS_CONFIG = {
  pending: { label: '待接收', color: 'bg-orange-100 text-orange-700 border-orange-200', dotColor: 'bg-orange-500' },
  returned: { label: '已退回', color: 'bg-red-100 text-red-700 border-red-200', dotColor: 'bg-red-500' },
  confirmed: { label: '已接收', color: 'bg-blue-100 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' },
  pool: { label: '订单池', color: 'bg-purple-100 text-purple-700 border-purple-200', dotColor: 'bg-purple-500' },
  producing: { label: '生产中', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dotColor: 'bg-yellow-500' },
  in_production: { label: '生产中', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dotColor: 'bg-yellow-500' },
  shipped: { label: '已发货', color: 'bg-green-100 text-green-700 border-green-200', dotColor: 'bg-green-500' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-700 border-gray-200', dotColor: 'bg-gray-500' },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_CONFIG;

// Tab definition
export const ORDER_TABS = [
  { value: 'all', label: '全部订单', statuses: [] },
  { value: 'pending', label: '待接收', statuses: ['pending'] },
  { value: 'confirmed', label: '已接收', statuses: ['confirmed'] },
  { value: 'producing', label: '生产中', statuses: ['producing', 'in_production', 'pool'] },
  { value: 'shipped', label: '已发货', statuses: ['shipped'] },
  { value: 'completed', label: '已完成', statuses: ['completed'] },
] as const;

// Order item schema
export const orderItemSchema = z.object({
  product_name: z.string().min(1, '产品名称不能为空'),
  specification: z.string(),
  quantity: z.coerce.number().int().min(1, '数量必须大于0'),
  unit: z.string(),
  unit_price: z.coerce.number().min(0, '单价不能为负数'),
});

// Order form schema - matches form default values exactly
export const orderFormSchema = z.object({
  order_no: z.string().min(1, '订单号不能为空'),
  customer_name: z.string().min(1, '客户名称不能为空'),
  delivery_date: z.string(),
  remark: z.string(),
  items: z.array(orderItemSchema).min(1, '至少需要一个订单项'),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

// Order type from API
export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  specifications: string | null;
  quantity: number;
  unit: string | null;
  unit_price: number;
  subtotal: number;
  created_at: string;
  updated_at: string | null;
}

export interface Order {
  id: string;
  order_no: string;
  tenant_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  status: string;
  total_amount: number;
  deposit_amount: number;
  delivery_date: string | null;
  remark: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  items: OrderItem[];
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

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  source: string | null;
  status: string | null;
  remark: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string | null;
}

// Format amount from cents to yuan
export function formatAmount(amount: number): string {
  return (amount / 100).toFixed(2);
}

// Format date
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
