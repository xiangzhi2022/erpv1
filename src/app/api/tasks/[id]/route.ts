import { NextResponse } from "next/server";
import {
  getTaskById,
  updateTask,
  deleteTask,
  toggleTask,
} from "@/app/actions/tasks";

// GET /api/tasks/[id] - 查询单个任务
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) {
      return NextResponse.json(
        { success: false, error: "任务不存在" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: task });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "查询任务失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] - 部分更新任务
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 特殊操作：切换完成状态
    if (body.action === "toggle") {
      const task = await toggleTask(id);
      return NextResponse.json({ success: true, data: task });
    }

    const task = await updateTask(id, body);

    // 如果更新了指派负责人，创建分配通知
    if (body.assignee_name && body.assignee_id) {
      try {
        const { createNotification } = await import("@/app/actions/tasks");
        await createNotification({
          task_id: id,
          type: "assignment",
          title: `任务重新分配: ${task.title}`,
          message: `任务"${task.title}"已重新分配给 ${body.assignee_name}`,
        });
      } catch {
        // 通知创建失败不影响主流程
      }
    }

    return NextResponse.json({ success: true, data: task });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "更新任务失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT /api/tasks/[id] - 完整更新任务
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 特殊操作：切换完成状态
    if (body.action === "toggle") {
      const task = await toggleTask(id);
      return NextResponse.json({ success: true, data: task });
    }

    const task = await updateTask(id, body);
    return NextResponse.json({ success: true, data: task });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "更新任务失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - 删除任务
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "删除任务失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
