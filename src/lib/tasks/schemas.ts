import { z } from 'zod';
import { ApiError, type ApiFieldErrors } from '@/lib/api/errors';

export const TASK_STATUS_VALUES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export const NOTIFICATION_TYPE_VALUES = ['assignment', 'due_soon', 'overdue'] as const;

const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable();
const nullableUuid = z.string().uuid().nullable();
const booleanQueryValue = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
]);
const integerQueryValue = (minimum: number, maximum: number) => z.union([
  z.number().int(),
  z.string().regex(/^(?:0|[1-9]\d*)$/).transform(Number),
]).pipe(z.number().int().min(minimum).max(maximum));
const dueDateSchema = z.union([
  z.string().date(),
  z.string().datetime({ offset: true }),
]).nullable();

export const taskIdSchema = z.object({ id: z.string().uuid() }).strict();

export const taskQuerySchema = z.object({
  status: z.enum(TASK_STATUS_VALUES).optional(),
  category_id: z.string().uuid().optional(),
  completed: booleanQueryValue.optional(),
  search: z.string().trim().min(1).max(64)
    .regex(/^[\p{L}\p{N}\s-]+$/u, '搜索内容包含不支持的字符').optional(),
  priority: integerQueryValue(0, 3).optional(),
  assignee_id: z.string().uuid().optional(),
  page: integerQueryValue(1, 10_000).default(1),
  pageSize: integerQueryValue(1, 100).default(50),
}).strict();

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: nullableText(2_000).optional(),
  status: z.enum(TASK_STATUS_VALUES).default('pending'),
  priority: z.number().int().min(0).max(3).default(0),
  category_id: nullableUuid.optional(),
  assignee_id: nullableUuid.optional(),
  assignee_name: nullableText(100).optional(),
  completed: z.boolean().optional(),
  due_date: dueDateSchema.optional(),
}).strict()
  .transform((input) => ({
    ...input,
    completed: input.completed ?? input.status === 'completed',
  }))
  .superRefine((input, context) => {
    if (input.completed !== (input.status === 'completed')) {
      context.addIssue({
        code: 'custom',
        path: ['completed'],
        message: 'completed 必须与 completed 状态一致',
      });
    }
  });

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: nullableText(2_000).optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  category_id: nullableUuid.optional(),
  assignee_id: nullableUuid.optional(),
  assignee_name: nullableText(100).optional(),
  completed: z.boolean().optional(),
  due_date: dueDateSchema.optional(),
}).strict()
  .refine((input) => Object.keys(input).length > 0, '没有可更新的任务字段')
  .transform((input) => input.status === undefined
    ? input
    : { ...input, completed: input.completed ?? input.status === 'completed' })
  .superRefine((input, context) => {
    if (input.completed !== undefined && input.status === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: '更新 completed 时必须同时提供 status',
      });
    }
    if (input.status !== undefined && input.completed !== (input.status === 'completed')) {
      context.addIssue({
        code: 'custom',
        path: ['completed'],
        message: 'completed 必须与 completed 状态一致',
      });
    }
  });

export const taskToggleSchema = z.object({ action: z.literal('toggle') }).strict();
export const taskMutationSchema = z.union([taskToggleSchema, taskUpdateSchema]);

export const notificationIdSchema = taskIdSchema;
export const notificationQuerySchema = z.object({
  read: booleanQueryValue.optional(),
  type: z.enum(NOTIFICATION_TYPE_VALUES).optional(),
  limit: integerQueryValue(1, 100).default(50),
}).strict();
export const notificationActionSchema = z.object({
  action: z.enum(['markAllRead', 'checkOverdue']),
}).strict();
export const notificationCreateSchema = z.object({
  task_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  type: z.enum(NOTIFICATION_TYPE_VALUES),
  title: z.string().trim().min(1).max(200),
  message: nullableText(2_000).optional(),
}).strict();

function actionFieldErrors(error: z.ZodError): ApiFieldErrors {
  const flattened = z.flattenError(error);
  const fields: ApiFieldErrors = {};
  for (const [field, messages] of Object.entries(
    flattened.fieldErrors as Record<string, string[] | undefined>,
  )) {
    if (messages?.length) fields[field] = messages;
  }
  if (flattened.formErrors.length) fields._root = flattened.formErrors;
  return fields;
}

export function parseTaskActionInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      'VALIDATION_FAILED',
      422,
      '请求参数校验失败',
      actionFieldErrors(parsed.error),
    );
  }
  return parsed.data;
}

export type TaskFilters = z.infer<typeof taskQuerySchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type NotificationFilters = z.infer<typeof notificationQuerySchema>;
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
