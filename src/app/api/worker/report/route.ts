import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (user.role !== "factory_user") {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const { task_id, action } = await request.json();
    
    if (!task_id || !action) {
      return NextResponse.json({ success: false, error: "参数不完整" }, { status: 400 });
    }

    const cookies = request.headers.get("cookie") || "";
    const supabase = getSupabaseClient(cookies);

    // 获取任务信息
    const { data: task } = await supabase
      .from("production_tasks")
      .select("id, worker_id, progress, order_id, started_at")
      .eq("id", task_id)
      .single();

    if (!task) {
      return NextResponse.json({ success: false, error: "任务不存在" }, { status: 404 });
    }

    // 验证是否是当前工人的任务
    if (task.worker_id !== user.id) {
      return NextResponse.json({ success: false, error: "无权操作此任务" }, { status: 403 });
    }

    // 更新任务状态
    let newProgress = task.progress;
    if (action === "start") {
      newProgress = "processing";
    } else if (action === "complete") {
      newProgress = "completed";
    } else {
      return NextResponse.json({ success: false, error: "无效的操作" }, { status: 400 });
    }

    const updateData: { progress: string; started_at?: string; completed_at?: string } = {
      progress: newProgress,
    };
    
    if (newProgress === "processing" && !task.started_at) {
      updateData.started_at = new Date().toISOString();
    } else if (newProgress === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("production_tasks")
      .update(updateData)
      .eq("id", task_id);

    if (error) {
      console.error("更新任务失败:", error);
      return NextResponse.json({ success: false, error: "更新失败" }, { status: 500 });
    }

    // 检查是否所有任务都完成了，如果是则更新订单状态
    const { data: remainingTasks } = await supabase
      .from("production_tasks")
      .select("id")
      .eq("order_id", task.order_id)
      .neq("progress", "completed");

    if (!remainingTasks || remainingTasks.length === 0) {
      await supabase
        .from("orders")
        .update({ status: "shipped" })
        .eq("id", task.order_id);
    }

    return NextResponse.json({ 
      success: true, 
      message: newProgress === "completed" ? "任务已完成" : "任务已开始",
      progress: newProgress,
    });
  } catch (error) {
    console.error("报工失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
