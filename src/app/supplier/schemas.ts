import { z } from 'zod';

// 供应类别枚举
export const supplierCategories = [
  '原材料',
  '包装耗材',
  '外协加工',
  '办公设备',
] as const;

export type SupplierCategory = typeof supplierCategories[number];

// 信用评级枚举
export const supplierRatings = ['A', 'B', 'C', 'D'] as const;

export type SupplierRating = typeof supplierRatings[number];

// 合作状态枚举
export const supplierStatuses = [
  { value: 'active', label: '活跃' },
  { value: 'inspecting', label: '考察中' },
  { value: 'blacklisted', label: '已拉黑' },
] as const;

export type SupplierStatus = typeof supplierStatuses[number]['value'];

// 供应商表单 Schema (zod v4 compatible)
export const supplierFormSchema = z.object({
  name: z.string().min(1, '供应商名称不能为空').max(200, '名称最多200字'),
  contactPerson: z.string().max(100, '联系人最多100字'),
  phone: z.string().max(20, '电话最多20位'),
  email: z.string().max(200, '邮箱最多200字'),
  category: z.enum(supplierCategories, { message: '请选择供应类别' }),
  rating: z.enum(supplierRatings, { message: '请选择评级' }),
  status: z.enum(['active', 'inspecting', 'blacklisted'], { message: '请选择状态' }),
  address: z.string().max(500, '地址最多500字'),
  remark: z.string().max(1000, '备注最多1000字'),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

// 供应商数据类型（从API返回）
export interface Supplier {
  id: string;
  supplier_code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  rating: string;
  status: string;
  address: string | null;
  remark: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}
