import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

/** production_tasks.status 合法状态 */
type TaskStatus = "pending" | "processing" | "completed";

/** 合法状态流转: pending → processing → completed */
const VALID_TRANSITIONS: Record<string, TaskStatus> = {
  start: "processing",     // pending → processing
  complete: "completed",   // processing → completed
};

const REQUIRED_PREV_STATUS: Record<string, TaskStatus> = {
  start: "pending",
  complete: "processing",
};

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (user.role !== "factory_user") {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const body = await request.json();
    const { task_id, action } = body as { task_id?: string; action?: string };

    if (!task_id || !action) {
      return NextResponse.json({ success: false, error: "参数不完整" }, { status: 400 });
    }

    if (!VALID_TRANSITIONS[action]) {
      return NextResponse.json({ success: false, error: "无效的操作类型" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 获取任务信息 — 字段名对齐 production_tasks schema
    const { data: task, error: fetchError } = await supabase
      .from("production_tasks")
      .select("id, status, order_id, tenant_id, start_date, end_date")
      .eq("id", task_id)
      .single();

    if (fetchError || !task) {
      return NextResponse.json({ success: false, error: "任务不存在" }, { status: 404 });
    }

    // 租户级权限校验（production_tasks 无 worker_id，使用 tenant_id 过滤）
    if (user.tenant_id && task.tenant_id && task.tenant_id !== user.tenant_id) {
      return NextResponse.json({ success: false, error: "无权操作此任务" }, { status: 403 });
    }

    // 状态流转校验：只允许合法的前驱状态
    const requiredPrev = REQUIRED_PREV_STATUS[action];
    if (task.status !== requiredPrev) {
      return NextResponse.json(
        {
          success: false,
          error: `状态不合法: 当前"${task.status}", 操作"${action}"要求状态为"${requiredPrev}"`,
        },
        { status: 409 }
      );
    }

    const newStatus: TaskStatus = VALID_TRANSITIONS[action];

    // 构建更新数据 — 字段名对齐 production_tasks schema (start_date/end_date)
    const updateData: { status: string; start_date?: string; end_date?: string; updated_at?: string } = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "processing" && !task.start_date) {
      updateData.start_date = new Date().toISOString();
    } else if (newStatus === "completed") {
      updateData.end_date = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("production_tasks")
      .update(updateData)
      .eq("id", task_id);

    if (updateError) {
      console.error("更新任务失败:", updateError);
      return NextResponse.json({ success: false, error: "更新失败" }, { status: 500 });
    }

    // 订单联动：所有任务完成后将订单更新为 "producing"（而非直接 "shipped"）
    // shipped 状态应由后续发货流程触发，避免跳过中间状态
    if (newStatus === "completed" && task.order_id) {
      const { data: remainingTasks, error: remainError } = await supabase
        .from("production_tasks")
        .select("id")
        .eq("order_id", task.order_id)
        .neq("status", "completed");

      if (!remainError && (!remainingTasks || remainingTasks.length === 0)) {
        await supabase
          .from("orders")
          .update({ status: "producing", updated_at: new Date().toISOString() })
          .eq("id", task.order_id);
      }
    }

    return NextResponse.json({
      success: true,
      message: newStatus === "completed" ? "任务已完成" : "任务已开始",
      status: newStatus,
    });
  } catch (error) {
    console.error("报工失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
