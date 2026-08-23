"use server";

import { createClient } from '@/lib/supabase/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import type { EnterprisePermissionCode } from '@/lib/enterprise/permissions';
import type { Notification, Task } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import {
  notificationCreateSchema,
  notificationIdSchema,
  notificationQuerySchema,
  parseTaskActionInput,
  taskCreateSchema,
  taskIdSchema,
  taskQuerySchema,
  taskUpdateSchema,
  type NotificationCreateInput,
  type NotificationFilters,
  type TaskCreateInput,
  type TaskFilters,
  type TaskUpdateInput,
} from '@/lib/tasks/schemas';
import {
  createTaskNotificationWithAccess,
  createTaskWithNotificationWithAccess,
  markAllNotificationsReadWithAccess,
  markNotificationReadWithAccess,
  toggleTaskWithAccess,
  updateTaskWithNotificationWithAccess,
} from '@/lib/tasks/service';

const TASK_SELECT = 'id, enterprise_id, title, description, status, priority, category_id, assignee_id, assignee_name, assignee_avatar, due_date, completed, created_at, updated_at';
const NOTIFICATION_SELECT = 'id, enterprise_id, task_id, recipient_id, type, title, message, read, created_at, updated_at';

async function taskAccess(...permissions: EnterprisePermissionCode[]) {
  const context = await getEnterpriseContext();
  for (const permission of permissions) requirePermission(context, permission);
  return {
    client: await createClient(),
    enterpriseId: context.enterpriseId,
    userId: context.userId,
  };
}

async function taskAccessAny(...permissions: EnterprisePermissionCode[]) {
  const context = await getEnterpriseContext();
  const matched = permissions.find((permission) => context.grants.has(permission));
  requirePermission(context, matched ?? permissions[0]);
  return {
    client: await createClient(),
    enterpriseId: context.enterpriseId,
    userId: context.userId,
  };
}

function databaseError(event: string, error: { code?: string; message: string }): never {
  console.error(event, { code: error.code });
  throw new Error('数据操作失败');
}

async function createNotificationWithAccess(
  access: Awaited<ReturnType<typeof taskAccess>>,
  input: NotificationCreateInput,
) {
  return createTaskNotificationWithAccess(access, input);
}

export async function getTasks(filtersInput?: unknown): Promise<{ tasks: Task[]; total: number }> {
  const filters: TaskFilters = parseTaskActionInput(taskQuerySchema, filtersInput ?? {});
  const { client, enterpriseId } = await taskAccess('tasks.read');
  const from = (filters.page - 1) * filters.pageSize;
  let query = client.from('tasks').select(TASK_SELECT, { count: 'exact' })
    .eq('enterprise_id', enterpriseId).order('created_at', { ascending: false })
    .range(from, from + filters.pageSize - 1);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.completed !== undefined) query = query.eq('completed', filters.completed);
  if (filters.priority !== undefined) query = query.eq('priority', filters.priority);
  if (filters.assignee_id) query = query.eq('assignee_id', filters.assignee_id);
  if (filters.search) {
    const escaped = filters.search.replace(/[%_]/g, (character) => `\\${character}`);
    query = query.ilike('title', `%${escaped}%`);
  }
  const { data, error, count } = await query;
  if (error) databaseError('task.list_failed', error);
  return { tasks: (data as Task[]) ?? [], total: count ?? 0 };
}

export async function getTaskById(idInput: unknown): Promise<Task | null> {
  const { id } = parseTaskActionInput(taskIdSchema, { id: idInput });
  const { client, enterpriseId } = await taskAccess('tasks.read');
  const { data, error } = await client.from('tasks').select(TASK_SELECT)
    .eq('enterprise_id', enterpriseId).eq('id', id).maybeSingle();
  if (error) databaseError('task.get_failed', error);
  return data as Task | null;
}

export async function createTask(inputValue: unknown): Promise<Task> {
  const input: TaskCreateInput = parseTaskActionInput(taskCreateSchema, inputValue);
  const access = await taskAccess('tasks.manage');
  return (await createTaskWithNotificationWithAccess(access, input)).task;
}

export async function updateTask(idInput: unknown, inputValue: unknown): Promise<Task> {
  const { id } = parseTaskActionInput(taskIdSchema, { id: idInput });
  const input: TaskUpdateInput = parseTaskActionInput(taskUpdateSchema, inputValue);
  const access = await taskAccess('tasks.manage');
  return (await updateTaskWithNotificationWithAccess(access, id, input)).task;
}

export async function toggleTask(idInput: unknown): Promise<Task> {
  const { id } = parseTaskActionInput(taskIdSchema, { id: idInput });
  return toggleTaskWithAccess(await taskAccess('tasks.manage'), id);
}

export async function deleteTask(idInput: unknown): Promise<void> {
  const { id } = parseTaskActionInput(taskIdSchema, { id: idInput });
  const { client, enterpriseId } = await taskAccess('tasks.manage');
  const { data, error } = await client.from('tasks').delete()
    .eq('enterprise_id', enterpriseId).eq('id', id).select('id').maybeSingle();
  if (error) databaseError('task.delete_failed', error);
  if (!data) throw ApiError.notFound('TASK_NOT_FOUND', '任务不存在');
}

export async function getTaskStats() {
  const { client, enterpriseId } = await taskAccess('tasks.read');
  const countStatus = async (status?: 'completed' | 'pending' | 'in_progress') => {
    let query = client.from('tasks').select('id', { count: 'exact', head: true })
      .eq('enterprise_id', enterpriseId);
    if (status) query = query.eq('status', status);
    const { count, error } = await query;
    if (error) databaseError('task.stats_failed', error);
    return count ?? 0;
  };
  const [total, completed, pending, inProgress] = await Promise.all([
    countStatus(), countStatus('completed'), countStatus('pending'), countStatus('in_progress'),
  ]);
  const { count: overdue, error } = await client.from('tasks')
    .select('id', { count: 'exact', head: true }).eq('enterprise_id', enterpriseId)
    .lt('due_date', new Date().toISOString()).neq('status', 'completed');
  if (error) databaseError('task.overdue_stats_failed', error);
  return { total, completed, pending, in_progress: inProgress, overdue: overdue ?? 0 };
}

export async function createNotification(inputValue: unknown): Promise<Notification> {
  const input = parseTaskActionInput(notificationCreateSchema, inputValue);
  const access = await taskAccessAny('notifications.manage', 'tasks.manage');
  return (await createNotificationWithAccess(access, input)).notification;
}

export async function getNotifications(filtersInput?: unknown): Promise<Notification[]> {
  const filters: NotificationFilters = parseTaskActionInput(notificationQuerySchema, filtersInput ?? {});
  const { client, enterpriseId, userId } = await taskAccess('notifications.read');
  let query = client.from('notifications').select(NOTIFICATION_SELECT)
    .eq('enterprise_id', enterpriseId).eq('recipient_id', userId)
    .order('created_at', { ascending: false }).limit(filters.limit);
  if (filters.read !== undefined) query = query.eq('read', filters.read);
  if (filters.type) query = query.eq('type', filters.type);
  const { data, error } = await query;
  if (error) databaseError('notification.list_failed', error);
  return (data as Notification[]) ?? [];
}

export async function markNotificationRead(idInput: unknown): Promise<Notification> {
  const { id } = parseTaskActionInput(notificationIdSchema, { id: idInput });
  return markNotificationReadWithAccess(await taskAccess('notifications.read'), id);
}

export async function markAllNotificationsRead(): Promise<number> {
  return markAllNotificationsReadWithAccess(await taskAccess('notifications.read'));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { client, enterpriseId, userId } = await taskAccess('notifications.read');
  const { count, error } = await client.from('notifications')
    .select('id', { count: 'exact', head: true }).eq('enterprise_id', enterpriseId)
    .eq('recipient_id', userId).eq('read', false);
  if (error) databaseError('notification.unread_count_failed', error);
  return count ?? 0;
}

export async function checkOverdueTasks(): Promise<number> {
  const access = await taskAccess('tasks.manage', 'notifications.manage');
  const now = new Date();
  const threeDaysLater = new Date(now);
  threeDaysLater.setUTCDate(threeDaysLater.getUTCDate() + 3);
  const [upcoming, overdue] = await Promise.all([
    access.client.from('tasks').select('id, title, due_date, assignee_id, assignee_name, status')
      .eq('enterprise_id', access.enterpriseId).lt('due_date', threeDaysLater.toISOString())
      .gte('due_date', now.toISOString()).neq('status', 'completed'),
    access.client.from('tasks').select('id, title, due_date, assignee_id, assignee_name, status')
      .eq('enterprise_id', access.enterpriseId).lt('due_date', now.toISOString())
      .neq('status', 'completed'),
  ]);
  if (upcoming.error) databaseError('notification.upcoming_lookup_failed', upcoming.error);
  if (overdue.error) databaseError('notification.overdue_lookup_failed', overdue.error);
  const candidates = [
    ...(upcoming.data ?? []).map((task) => ({ task, type: 'due_soon' as const })),
    ...(overdue.data ?? []).map((task) => ({ task, type: 'overdue' as const })),
  ];
  let created = 0;
  for (const { task, type } of candidates) {
    const dueLabel = task.due_date
      ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC' }).format(new Date(task.due_date))
      : '未设置';
    const prefix = type === 'due_soon' ? '任务即将到期' : '任务已过期';
    const result = await createNotificationWithAccess(access, {
      task_id: task.id,
      recipient_id: task.assignee_id ?? access.userId,
      type,
      title: `${prefix}: ${task.title}`,
      message: `任务"${task.title}"${type === 'due_soon' ? '即将到期' : '已超过截止日期'}，负责人: ${task.assignee_name || '未分配'}，截止日期: ${dueLabel}`,
    });
    if (result.created) created += 1;
  }
  return created;
}
