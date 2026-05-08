import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (user.role !== "factory_user") {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    // 获取工人的任务
    const { data: tasks, error } = await supabase
      .from("production_tasks")
      .select(`
        *,
        order:orders!inner(id, order_no, customer_name, customer_address)
      `)
      .eq("worker_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取任务失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    // 分类统计
    const taskList = tasks || [];
    const stats = {
      pending: taskList.filter((t: any) => t.progress === "pending").length,
      processing: taskList.filter((t: any) => t.progress === "processing").length,
      completed: taskList.filter((t: any) => t.progress === "completed").length,
      total: taskList.length,
    };

    return NextResponse.json({ 
      success: true, 
      tasks: taskList,
      stats,
    });
  } catch (error) {
    console.error("获取任务失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
