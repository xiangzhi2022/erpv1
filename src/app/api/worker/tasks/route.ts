import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

/** production_tasks.status 合法值 */
const VALID_TASK_STATUSES = ["pending", "processing", "completed"] as const;
type TaskStatus = (typeof VALID_TASK_STATUSES)[number];

/** 前端展示用的映射字段 */
interface WorkerTaskRow {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  completed: number;
  status: TaskStatus;
  workshop_id: string | null;
  tenant_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string | null;
  // joined
  order: { id: string; order_no: string; customer_name: string; customer_address: string } | null;
}

interface WorkerTaskResponse {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  completed: number;
  status: TaskStatus;
  workshop_id: string | null;
  order_no: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

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

    // production_tasks 表无 worker_id 列，使用 tenant_id 做租户级过滤
    let query = supabase
      .from("production_tasks")
      .select(
        `*, order:orders!inner(id, order_no, customer_name, customer_address)`
      )
      .order("created_at", { ascending: false });

    // 有 tenant_id 时按租户过滤，避免跨租户数据泄露
    if (user.tenant_id) {
      query = query.eq("tenant_id", user.tenant_id);
    }

    const { data: tasks, error } = await query;

    if (error) {
      console.error("获取任务失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    const taskList: WorkerTaskRow[] = tasks || [];

    // 将 join 结果拍平，方便前端消费
    const mapped: WorkerTaskResponse[] = taskList.map((t) => ({
      id: t.id,
      order_id: t.order_id,
      product_name: t.product_name,
      quantity: t.quantity,
      completed: t.completed,
      status: VALID_TASK_STATUSES.includes(t.status as TaskStatus)
        ? (t.status as TaskStatus)
        : "pending",
      workshop_id: t.workshop_id,
      order_no: t.order?.order_no ?? "",
      start_date: t.start_date,
      end_date: t.end_date,
      created_at: t.created_at,
    }));

    const stats = {
      pending: mapped.filter((t) => t.status === "pending").length,
      processing: mapped.filter((t) => t.status === "processing").length,
      completed: mapped.filter((t) => t.status === "completed").length,
      total: mapped.length,
    };

    return NextResponse.json({
      success: true,
      tasks: mapped,
      stats,
    });
  } catch (error) {
    console.error("获取任务失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
