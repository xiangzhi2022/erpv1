import { z } from "zod";

/**
 * 工厂/车间状态枚举
 */
export const WorkshopStatus = {
  NORMAL: "normal",
  MAINTENANCE: "maintenance",
  STOPPED: "stopped",
} as const;

export type WorkshopStatusType =
  (typeof WorkshopStatus)[keyof typeof WorkshopStatus];

/**
 * 状态显示配置
 */
export const statusConfig: Record<
  WorkshopStatusType,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  normal: {
    label: "正常",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
    dotColor: "bg-emerald-500",
  },
  maintenance: {
    label: "检修中",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
    dotColor: "bg-amber-500",
  },
  stopped: {
    label: "停工",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
    dotColor: "bg-red-500",
  },
};

/**
 * 车间表单验证 Schema
 */
export const workshopFormSchema = z.object({
  factory_code: z
    .string()
    .min(1, "车间编号不能为空")
    .regex(
      /^[A-Za-z]+-[A-Za-z0-9]+$/,
      "车间编号格式：字母-数字，如 WH-A01"
    ),
  name: z
    .string()
    .min(1, "车间名称不能为空")
    .max(100, "车间名称不超过100字"),
  location: z.string().max(200, "地址不超过200字"),
  manager: z.string().max(50, "负责人姓名不超过50字"),
  capacity: z
    .number({ error: "产能必须为数字" })
    .int("产能必须为整数")
    .min(0, "产能不能为负数"),
  current_load: z
    .number({ error: "负荷必须为数字" })
    .int("负荷必须为整数")
    .min(0, "负荷不能为负数"),
  status: z.enum(["normal", "maintenance", "stopped"]),
  description: z
    .string()
    .max(500, "描述不超过500字"),
});

export type WorkshopFormValues = z.infer<typeof workshopFormSchema>;

/**
 * 车间数据类型（来自API）
 */
export interface Workshop {
  id: string;
  factory_code: string;
  name: string;
  location: string | null;
  manager: string | null;
  capacity: number;
  current_load: number;
  load_percentage: number;
  status: WorkshopStatusType;
  tenant_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 列表统计类型
 */
export interface WorkshopStats {
  total: number;
  normal: number;
  maintenance: number;
  stopped: number;
  totalCapacity: number;
  totalLoad: number;
}
