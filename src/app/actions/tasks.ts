"use server";

import { getSupabaseClient } from "@/db/client";
import type { Task, InsertTask, Notification, InsertNotification } from "@/db/schema";

// ==================== Tasks ====================

// 查询任务列表（支持过滤和搜索）
export async function getTasks(filters?: {
  status?: string;
  category_id?: string;
  completed?: boolean;
  search?: string;
  priority?: number;
  assignee_id?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ tasks: Task[]; total: number }> {
  const client = getSupabaseClient();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from("tasks")
    .select("id, title, description, status, priority, category_id, assignee_id, assignee_name, assignee_avatar, due_date, completed, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id);
  }
  if (filters?.completed !== undefined) {
    query = query.eq("completed", filters.completed);
  }
  if (filters?.priority !== undefined) {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.assignee_id) {
    query = query.eq("assignee_id", filters.assignee_id);
  }
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,assignee_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`查询任务失败: ${error.message}`);
  return { tasks: (data as Task[]) ?? [], total: count ?? 0 };
}

// 根据 ID 查询单个任务
export async function getTaskById(id: string): Promise<Task | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("tasks")
    .select("id, title, description, status, priority, category_id, assignee_id, assignee_name, assignee_avatar, due_date, completed, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`查询任务失败: ${error.message}`);
  return data as Task | null;
}

// 创建任务
export async function createTask(input: InsertTask & { due_date?: string }): Promise<Task> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("tasks")
    .insert(input)
    .select("id, title, description, status, priority, category_id, assignee_id, assignee_name, assignee_avatar, due_date, completed, created_at, updated_at")
    .single();
  if (error) throw new Error(`创建任务失败: ${error.message}`);
  return data as Task;
}

// 更新任务
export async function updateTask(
  id: string,
  input: Partial<InsertTask & { due_date?: string }>
): Promise<Task> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("tasks")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, title, description, status, priority, category_id, assignee_id, assignee_name, assignee_avatar, due_date, completed, created_at, updated_at")
    .maybeSingle();
  if (error) throw new Error(`更新任务失败: ${error.message}`);
  if (!data) throw new Error("任务不存在或更新失败");
  return data as Task;
}

// 切换任务完成状态
export async function toggleTask(id: string): Promise<Task> {
  const client = getSupabaseClient();
  const { data: current, error: fetchError } = await client
    .from("tasks")
    .select("completed")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw new Error(`查询任务状态失败: ${fetchError.message}`);
  if (!current) throw new Error("任务不存在");

  const { data, error } = await client
    .from("tasks")
    .update({
      completed: !current.completed,
      status: !current.completed ? "completed" : "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, title, description, status, priority, category_id, assignee_id, assignee_name, assignee_avatar, due_date, completed, created_at, updated_at")
    .maybeSingle();
  if (error) throw new Error(`切换任务状态失败: ${error.message}`);
  if (!data) throw new Error("任务不存在或更新失败");
  return data as Task;
}

// 删除任务
export async function deleteTask(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("tasks").delete().eq("id", id);
  if (error) throw new Error(`删除任务失败: ${error.message}`);
}

// 统计任务数量
export async function getTaskStats(): Promise<{
  total: number;
  completed: number;
  pending: number;
  in_progress: number;
  overdue: number;
}> {
  const client = getSupabaseClient();

  const { count: total, error: totalError } = await client
    .from("tasks")
    .select("*", { count: "exact", head: true });
  if (totalError) throw new Error(`统计任务失败: ${totalError.message}`);

  const { count: completed, error: completedError } = await client
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("completed", true);
  if (completedError) throw new Error(`统计已完成任务失败: ${completedError.message}`);

  const { count: inProgress, error: inProgressError } = await client
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("status", "in_progress");
  if (inProgressError) throw new Error(`统计进行中任务失败: ${inProgressError.message}`);

  const { count: overdue, error: overdueError } = await client
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .lt("due_date", new Date().toISOString())
    .neq("status", "completed");
  if (overdueError) throw new Error(`统计过期任务失败: ${overdueError.message}`);

  return {
    total: total ?? 0,
    completed: completed ?? 0,
    pending: (total ?? 0) - (completed ?? 0) - (inProgress ?? 0),
    in_progress: inProgress ?? 0,
    overdue: overdue ?? 0,
  };
}

// ==================== Notifications ====================

// 创建通知
export async function createNotification(input: InsertNotification): Promise<Notification> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("notifications")
    .insert(input)
    .select("id, task_id, type, title, message, read, created_at")
    .single();
  if (error) throw new Error(`创建通知失败: ${error.message}`);
  return data as Notification;
}

// 获取通知列表
export async function getNotifications(filters?: {
  read?: boolean;
  type?: string;
  limit?: number;
}): Promise<Notification[]> {
  const client = getSupabaseClient();
  const limit = filters?.limit ?? 50;

  let query = client
    .from("notifications")
    .select("id, task_id, type, title, message, read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.read !== undefined) {
    query = query.eq("read", filters.read);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }

  const { data, error } = await query;
  if (error) throw new Error(`查询通知失败: ${error.message}`);
  return (data as Notification[]) ?? [];
}

// 标记通知为已读
export async function markNotificationRead(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("notifications")
    .update({ read: true })
    .eq("id", id);
  if (error) throw new Error(`标记通知失败: ${error.message}`);
}

// 标记所有通知为已读
export async function markAllNotificationsRead(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("notifications")
    .update({ read: true })
    .eq("read", false);
  if (error) throw new Error(`标记全部通知失败: ${error.message}`);
}

// 获取未读通知数量
export async function getUnreadNotificationCount(): Promise<number> {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("read", false);
  if (error) throw new Error(`统计未读通知失败: ${error.message}`);
  return count ?? 0;
}

// 检查即将过期的任务并创建预警通知
export async function checkOverdueTasks(): Promise<number> {
  const client = getSupabaseClient();

  // 查找即将在未来3天内到期且未完成的任务
  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const now = new Date();

  const { data: upcomingTasks, error: fetchError } = await client
    .from("tasks")
    .select("id, title, due_date, assignee_name, status")
    .lt("due_date", threeDaysLater.toISOString())
    .gte("due_date", now.toISOString())
    .neq("status", "completed");
  if (fetchError) throw new Error(`查询即将到期任务失败: ${fetchError.message}`);

  // 查找已经过期且未完成的任务
  const { data: overdueTasks, error: overdueError } = await client
    .from("tasks")
    .select("id, title, due_date, assignee_name, status")
    .lt("due_date", now.toISOString())
    .neq("status", "completed");
  if (overdueError) throw new Error(`查询过期任务失败: ${overdueError.message}`);

  let notifyCount = 0;

  // 为即将到期任务创建提醒
  if (upcomingTasks && upcomingTasks.length > 0) {
    for (const task of upcomingTasks) {
      // 检查是否已有此任务的到期提醒（避免重复）
      const { data: existing } = await client
        .from("notifications")
        .select("id")
        .eq("task_id", task.id)
        .eq("type", "due_soon")
        .maybeSingle();

      if (!existing) {
        await createNotification({
          task_id: task.id,
          type: "due_soon",
          title: `任务即将到期: ${task.title}`,
          message: `任务"${task.title}"即将到期，负责人: ${task.assignee_name || "未分配"}，截止日期: ${task.due_date ? new Date(task.due_date).toLocaleDateString("zh-CN") : "未设置"}`,
        });
        notifyCount++;
      }
    }
  }

  // 为已过期任务创建预警
  if (overdueTasks && overdueTasks.length > 0) {
    for (const task of overdueTasks) {
      const { data: existing } = await client
        .from("notifications")
        .select("id")
        .eq("task_id", task.id)
        .eq("type", "overdue")
        .maybeSingle();

      if (!existing) {
        await createNotification({
          task_id: task.id,
          type: "overdue",
          title: `任务已过期: ${task.title}`,
          message: `任务"${task.title}"已超过截止日期，负责人: ${task.assignee_name || "未分配"}，截止日期: ${task.due_date ? new Date(task.due_date).toLocaleDateString("zh-CN") : "未设置"}`,
        });
        notifyCount++;
      }
    }
  }

  return notifyCount;
}
