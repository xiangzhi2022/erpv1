import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/db/database.types';
import type { Notification, Task } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import type {
  NotificationCreateInput,
  TaskCreateInput,
  TaskUpdateInput,
} from '@/lib/tasks/schemas';

export interface TaskServiceAccess {
  client: SupabaseClient<Database>;
  enterpriseId: string;
}

interface RpcError {
  code?: string;
  message: string;
}

interface RpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
}

type RpcOperation = 'toggle' | 'markOne' | 'markAll' | 'notification' | 'createTask' | 'updateTask';

const taskResultSchema = z.object({
  id: z.string().uuid(),
  enterprise_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  priority: z.number().int(),
  category_id: z.string().uuid().nullable(),
  assignee_id: z.string().uuid().nullable(),
  assignee_name: z.string().nullable(),
  assignee_avatar: z.string().nullable(),
  due_date: z.string().nullable(),
  completed: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const notificationResultSchema = z.object({
  id: z.string().uuid(),
  enterprise_id: z.string().uuid(),
  task_id: z.string().uuid().nullable(),
  recipient_id: z.string().uuid().nullable(),
  type: z.string(),
  title: z.string(),
  message: z.string().nullable(),
  read: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const taskMutationResultSchema = z.object({
  task: taskResultSchema,
  notification: notificationResultSchema.nullable(),
});

const taskNotificationResultSchema = z.object({
  notification: notificationResultSchema,
  created: z.boolean(),
});

function rpcResultRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

function throwRpcError(operation: RpcOperation, error: RpcError): never {
  if (error.code === 'P0001') {
    throw ApiError.conflict('TASK_STATE_CONFLICT', '任务状态已被其他操作更新，请刷新后重试');
  }
  if (error.code === 'P0002') {
    if (operation === 'toggle') throw ApiError.notFound('TASK_NOT_FOUND', '任务不存在');
    if (operation === 'markOne') {
      throw ApiError.notFound('NOTIFICATION_NOT_FOUND', '通知不存在');
    }
    if (operation === 'notification') {
      throw ApiError.notFound('TASK_NOTIFICATION_TARGET_NOT_FOUND', '任务或通知接收人不存在');
    }
    throw ApiError.notFound('TASK_REFERENCE_NOT_FOUND', '任务、分类或负责人不存在');
  }
  if (error.code === '42501') {
    throw ApiError.forbidden('RPC_FORBIDDEN', '没有执行该操作的权限');
  }
  if (error.code === '28000') throw ApiError.unauthorized();
  if (error.code === '22023') {
    throw ApiError.unprocessable('INVALID_RPC_INPUT', '请求参数无法处理');
  }
  console.error(`task.${operation}_rpc_failed`, { code: error.code });
  throw new Error('数据操作失败');
}

async function callRpc(
  access: TaskServiceAccess,
  operation: RpcOperation,
  functionName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await (access.client as unknown as RpcClient).rpc(functionName, args);
  if (error) throwRpcError(operation, error);
  return data;
}

export async function toggleTaskWithAccess(
  access: TaskServiceAccess,
  id: string,
): Promise<Task> {
  const { data: current, error } = await access.client.from('tasks').select('completed')
    .eq('enterprise_id', access.enterpriseId).eq('id', id).maybeSingle();
  if (error) {
    console.error('task.toggle_lookup_failed', { code: error.code });
    throw new Error('查询任务状态失败');
  }
  if (!current) throw ApiError.notFound('TASK_NOT_FOUND', '任务不存在');

  const data = await callRpc(access, 'toggle', 'toggle_task', {
    target_enterprise_id: access.enterpriseId,
    target_task_id: id,
    expected_completed: current.completed,
  });
  const parsed = taskResultSchema.safeParse(rpcResultRow(data));
  if (!parsed.success) {
    console.error('task.toggle_rpc_invalid_result');
    throw new Error('数据操作失败');
  }
  return parsed.data as Task;
}

export async function markNotificationReadWithAccess(
  access: TaskServiceAccess,
  id: string,
): Promise<Notification> {
  const data = await callRpc(access, 'markOne', 'mark_notification_read', {
    target_enterprise_id: access.enterpriseId,
    target_notification_id: id,
  });
  const parsed = notificationResultSchema.safeParse(rpcResultRow(data));
  if (!parsed.success) {
    console.error('notification.mark_read_rpc_invalid_result');
    throw new Error('数据操作失败');
  }
  return parsed.data as Notification;
}

export async function markAllNotificationsReadWithAccess(
  access: TaskServiceAccess,
): Promise<number> {
  const data = await callRpc(access, 'markAll', 'mark_all_notifications_read', {
    target_enterprise_id: access.enterpriseId,
  });
  const parsed = z.coerce.number().int().nonnegative().safeParse(data);
  if (!parsed.success) {
    console.error('notification.mark_all_read_rpc_invalid_result');
    throw new Error('数据操作失败');
  }
  return parsed.data;
}

function rpcTaskFields(input: TaskCreateInput | TaskUpdateInput): Record<string, unknown> {
  const fields: Record<string, unknown> = { ...input };
  delete fields.completed;
  return fields;
}

export async function createTaskWithNotificationWithAccess(
  access: TaskServiceAccess,
  input: TaskCreateInput,
): Promise<{ task: Task; notification: Notification | null }> {
  const data = await callRpc(access, 'createTask', 'create_task_with_notification', {
    target_enterprise_id: access.enterpriseId,
    task_fields: rpcTaskFields(input),
  });
  const parsed = taskMutationResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error('task.create_rpc_invalid_result');
    throw new Error('数据操作失败');
  }
  return {
    task: parsed.data.task as Task,
    notification: parsed.data.notification as Notification | null,
  };
}

export async function updateTaskWithNotificationWithAccess(
  access: TaskServiceAccess,
  id: string,
  input: TaskUpdateInput,
): Promise<{ task: Task; notification: Notification | null }> {
  const data = await callRpc(access, 'updateTask', 'update_task_with_notification', {
    target_enterprise_id: access.enterpriseId,
    target_task_id: id,
    task_fields: rpcTaskFields(input),
  });
  const parsed = taskMutationResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error('task.update_rpc_invalid_result');
    throw new Error('数据操作失败');
  }
  return {
    task: parsed.data.task as Task,
    notification: parsed.data.notification as Notification | null,
  };
}

export async function createTaskNotificationWithAccess(
  access: TaskServiceAccess,
  input: NotificationCreateInput,
): Promise<{ notification: Notification; created: boolean }> {
  const data = await callRpc(access, 'notification', 'create_task_notification', {
    target_enterprise_id: access.enterpriseId,
    target_task_id: input.task_id,
    target_recipient_id: input.recipient_id,
    target_type: input.type,
    target_title: input.title,
    target_message: input.message ?? null,
  });
  const parsed = taskNotificationResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error('notification.create_rpc_invalid_result');
    throw new Error('数据操作失败');
  }
  return {
    notification: parsed.data.notification as Notification,
    created: parsed.data.created,
  };
}
