import { NextResponse } from "next/server";
import { getTasks, createTask, getTaskStats } from "@/app/actions/tasks";

// GET /api/tasks - 查询任务列表（支持分页、过滤、搜索）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const category_id = searchParams.get("category_id") ?? undefined;
    const completedStr = searchParams.get("completed");
    const completed = completedStr !== null ? completedStr === "true" : undefined;
    const search = searchParams.get("search") ?? undefined;
    const priorityStr = searchParams.get("priority");
    const priority = priorityStr !== null ? Number(priorityStr) : undefined;
    const assignee_id = searchParams.get("assignee_id") ?? undefined;
    const pageStr = searchParams.get("page");
    const page = pageStr ? Number(pageStr) : undefined;
    const pageSizeStr = searchParams.get("pageSize");
    const pageSize = pageSizeStr ? Number(pageSizeStr) : undefined;

    const [result, stats] = await Promise.all([
      getTasks({ status, category_id, completed, search, priority, assignee_id, page, pageSize }),
      getTaskStats(),
    ]);
    return NextResponse.json({
      success: true,
      data: result.tasks,
      total: result.total,
      stats,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "查询任务失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/tasks - 创建任务
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      status,
      priority,
      category_id,
      assignee_id,
      assignee_name,
      assignee_avatar,
      completed,
      due_date,
    } = body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "任务标题不能为空" },
        { status: 400 }
      );
    }
    const task = await createTask({
      title: title.trim(),
      description: description ?? null,
      status: status ?? "pending",
      priority: priority ?? 0,
      category_id: category_id ?? undefined,
      assignee_id: assignee_id ?? undefined,
      assignee_name: assignee_name ?? undefined,
      assignee_avatar: assignee_avatar ?? undefined,
      completed: completed ?? false,
      due_date: due_date ?? undefined,
    });

    // 如果有指派负责人，创建分配通知
    if (assignee_name) {
      try {
        const { createNotification } = await import("@/app/actions/tasks");
        await createNotification({
          task_id: task.id,
          type: "assignment",
          title: `新任务分配: ${task.title}`,
          message: `任务"${task.title}"已分配给 ${assignee_name}`,
        });
      } catch {
        // 通知创建失败不影响主流程
      }
    }

    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "创建任务失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
