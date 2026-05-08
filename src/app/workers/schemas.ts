import { z } from 'zod';

// 工种枚举
export const CRAFT_TYPES = [
  { value: 'cutting', label: '裁剪' },
  { value: 'sewing', label: '缝纫' },
  { value: 'qc', label: '质检' },
  { value: 'packaging', label: '包装' },
  { value: 'ironing', label: '熨烫' },
  { value: 'pattern', label: '打版' },
  { value: 'cutting_die', label: '刀模' },
  { value: 'assembly', label: '组装' },
  { value: 'other', label: '其他' },
] as const;

// 状态枚举
export const WORKER_STATUSES = [
  { value: 'active', label: '在岗', color: 'bg-green-100 text-green-800' },
  { value: 'on_leave', label: '请假', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'resigned', label: '离职', color: 'bg-red-100 text-red-800' },
] as const;

// 性别枚举
export const GENDERS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
] as const;

// 工人表单 Schema - 使用更宽松的类型定义避免 TS 兼容问题
export const workerFormSchema = z.object({
  worker_no: z.string(),
  name: z.string().min(1, '姓名不能为空').max(100, '姓名不能超过100字'),
  phone: z.string(),
  gender: z.string(),
  craft_type: z.string(),
  workshop_id: z.string(),
  status: z.enum(['active', 'on_leave', 'resigned']),
  skill_tags: z.string(),
  hire_date: z.string(),
  remark: z.string(),
});

export type WorkerFormValues = z.infer<typeof workerFormSchema>;

// 工人类型
export interface Worker {
  id: string;
  worker_no: string | null;
  name: string;
  phone: string | null;
  gender: string | null;
  craft_type: string | null;
  workshop_id: string | null;
  workshop_name: string | null;
  status: string;
  skill_tags: string | null;
  hire_date: string | null;
  remark: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

// 统计类型
export interface WorkerStats {
  total: number;
  active: number;
  onLeave: number;
  resigned: number;
  activeRate: number;
  craftDistribution: Record<string, number>;
}

// 辅助函数
export function getCraftLabel(value: string | null): string {
  if (!value) return '未分配';
  return CRAFT_TYPES.find(c => c.value === value)?.label || value;
}

export function getStatusInfo(value: string): { label: string; color: string } {
  const found = WORKER_STATUSES.find(s => s.value === value);
  return found ? { label: found.label, color: found.color } : { label: value, color: 'bg-gray-100 text-gray-800' };
}
