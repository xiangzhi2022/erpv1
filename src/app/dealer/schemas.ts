import { z } from 'zod/v4';

// 经销商表单验证 Schema
export const dealerFormSchema = z.object({
  name: z.string().min(2, '经销商名称至少2个字符').max(200, '经销商名称不能超过200个字符'),
  contactName: z.string().max(100, '联系人姓名不能超过100个字符'),
  phone: z.string()
    .refine((val) => val === '' || /^1[3-9]\d{9}$/.test(val), '请输入正确的手机号码'),
  region: z.string().max(200, '地区不能超过200个字符'),
  status: z.enum(['active', 'inactive']),
  remark: z.string().max(500, '备注不能超过500个字符'),
});

export type DealerFormValues = z.infer<typeof dealerFormSchema>;

// 经销商数据类型（从API返回）
export interface Dealer {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  region: string | null;
  status: string;
  remark: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

// 分页信息
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// API 响应类型
export interface DealerListResponse {
  success: boolean;
  data: Dealer[];
  pagination: Pagination;
  error?: string;
}

export interface DealerResponse {
  success: boolean;
  data?: Dealer;
  error?: string;
}
