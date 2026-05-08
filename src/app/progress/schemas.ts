import { z } from 'zod';

// 工单状态枚举
export const WorkOrderStatus = {
  PENDING: 'pending',        // 待排产
  SCHEDULING: 'scheduling',  // 排产中
  PRODUCING: 'producing',    // 生产中
  INSPECTING: 'inspecting',  // 质检中
  STORED: 'stored',          // 已入库
  ABORTED: 'aborted',        // 异常中止
} as const;

export type WorkOrderStatusType = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

export const WorkOrderStatusLabels: Record<WorkOrderStatusType, string> = {
  pending: '待排产',
  scheduling: '排产中',
  producing: '生产中',
  inspecting: '质检中',
  stored: '已入库',
  aborted: '异常中止',
};

// 优先级枚举
export const Priority = {
  URGENT: 'urgent',
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low',
} as const;

export type PriorityType = (typeof Priority)[keyof typeof Priority];

export const PriorityLabels: Record<PriorityType, string> = {
  urgent: '紧急',
  high: '高',
  normal: '普通',
  low: '低',
};

// 操作类型枚举
export const ProgressAction = {
  START: 'start',                      // 开工
  COMPLETE_CUTTING: 'complete_cutting', // 完成下料
  COMPLETE_ASSEMBLY: 'complete_assembly', // 完成组装
  COMPLETE_PAINTING: 'complete_painting', // 完成涂装
  QUALITY_CHECK: 'quality_check',       // 质检
  WAREHOUSE_IN: 'warehouse_in',         // 入库
  REPORT_PROGRESS: 'report_progress',   // 汇报进度
  REPORT_DEFECT: 'report_defect',       // 异常报告
  PAUSE: 'pause',                       // 暂停
  RESUME: 'resume',                     // 恢复
  ABORT: 'abort',                       // 中止
} as const;

export type ProgressActionType = (typeof ProgressAction)[keyof typeof ProgressAction];

export const ProgressActionLabels: Record<ProgressActionType, string> = {
  start: '开工',
  complete_cutting: '完成下料',
  complete_assembly: '完成组装',
  complete_painting: '完成涂装',
  quality_check: '质检',
  warehouse_in: '入库',
  report_progress: '汇报进度',
  report_defect: '异常报告',
  pause: '暂停',
  resume: '恢复',
  abort: '中止',
};

// 进度上报 Schema
export const progressReportSchema = z.object({
  work_order_id: z.string().uuid('工单ID格式错误'),
  action: z.enum([
    'start', 'complete_cutting', 'complete_assembly', 'complete_painting',
    'quality_check', 'warehouse_in', 'report_progress', 'report_defect',
    'pause', 'resume', 'abort',
  ] as const),
  completed_delta: z.number().int().min(0, '完成数量不能为负数').optional().default(0),
  remark: z.string().max(500, '备注最多500字').optional(),
});

// 工单查询参数 Schema
export const workOrderQuerySchema = z.object({
  status: z.string().optional(),
  workshop_id: z.string().optional(),
  keyword: z.string().optional(),
  priority: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// 工单数据类型
export interface WorkOrder {
  id: string;
  order_id: string;
  order_item_id: string | null;
  workshop_id: string | null;
  product_name: string;
  target_quantity: number;
  completed_quantity: number;
  status: WorkOrderStatusType;
  priority: PriorityType;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  remark: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  // 关联数据
  order?: { order_no: string; customer_name: string | null; delivery_date: string | null };
  workshop?: { name: string; code: string };
}

// 进度日志类型
export interface ProgressLog {
  id: string;
  work_order_id: string;
  operator_id: string | null;
  operator_name: string | null;
  action: ProgressActionType;
  completed_delta: number;
  remark: string | null;
  created_at: string;
}

// 看板统计
export interface ProgressStats {
  total: number;
  pending: number;
  producing: number;
  inspecting: number;
  stored: number;
  aborted: number;
  overdue: number;
}
