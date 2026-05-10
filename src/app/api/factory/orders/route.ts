import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (!["factory_admin", "super_admin"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    // 解析筛选参数
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const keyword = searchParams.get("keyword");

    // 构建查询 - 获取本工厂的订单
    let query = supabase
      .from("orders")
      .select(`
        id, order_no, customer_name, customer_phone, status, total_amount,
        delivery_date, remark, tenant_id, target_factory_id, created_at, updated_at,
        dealer:tenants!orders_dealer_id_fkey(id, name),
        items:order_items(id, product_name, quantity, unit_price, subtotal)
      `)
      .eq("target_factory_id", user.tenant_id || "")
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (keyword) {
      query = query.or(`order_no.ilike.%${keyword}%,customer_name.ilike.%${keyword}%`);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("获取订单失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    const orderList = orders || [];

    // 获取订单对应的生产任务 - 使用 status 字段（与 production_tasks 表一致）
    const orderIds = orderList.map((o: Record<string, unknown>) => o.id as string);
    let taskStats: { order_id: string; total: number; completed: number }[] = [];

    if (orderIds.length > 0) {
      const { data: tasks } = await supabase
        .from("production_tasks")
        .select("order_id, status")
        .in("order_id", orderIds);

      const taskMap = new Map<string, { total: number; completed: number }>();
      (tasks || []).forEach((t: Record<string, unknown>) => {
        const stats = taskMap.get(t.order_id as string) || { total: 0, completed: 0 };
        stats.total++;
        // production_tasks 表使用 status 字段，不是 progress
        if (t.status === "completed") stats.completed++;
        taskMap.set(t.order_id as string, stats);
      });

      taskStats = Array.from(taskMap.entries()).map(([order_id, stats]) => ({
        order_id,
        ...stats,
      }));
    }

    // 合并数据
    const ordersWithProgress = orderList.map((o: Record<string, unknown>) => {
      const stats = taskStats.find(s => s.order_id === o.id) || { total: 0, completed: 0 };
      return {
        ...o,
        total_tasks: stats.total,
        completed_tasks: stats.completed,
        progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      };
    });

    // 统计（基于全量订单，不受筛选参数影响）
    const { data: allOrders, error: statsError } = await supabase
      .from("orders")
      .select("status")
      .eq("target_factory_id", user.tenant_id || "");

    if (statsError) {
      console.error("获取订单统计失败:", statsError);
    }

    const statusStats = {
      pending: (allOrders || []).filter((o: Record<string, unknown>) => o.status === "pending").length,
      confirmed: (allOrders || []).filter((o: Record<string, unknown>) => o.status === "confirmed").length,
      producing: (allOrders || []).filter((o: Record<string, unknown>) => o.status === "producing").length,
      shipped: (allOrders || []).filter((o: Record<string, unknown>) => o.status === "shipped").length,
      completed: (allOrders || []).filter((o: Record<string, unknown>) => o.status === "completed").length,
    };

    // 获取关联的生产任务总数和完成数
    const allOrderIds = (allOrders || []).map((o: Record<string, unknown>) => o.id as string);
    let totalTasks = 0;
    let completedTasks = 0;

    if (allOrderIds.length > 0) {
      const { data: allTasks } = await supabase
        .from("production_tasks")
        .select("status")
        .in("order_id", allOrderIds);

      totalTasks = (allTasks || []).length;
      completedTasks = (allTasks || []).filter((t: Record<string, unknown>) => t.status === "completed").length;
    }

    return NextResponse.json({
      success: true,
      orders: ordersWithProgress,
      stats: statusStats,
      taskStats: {
        total: totalTasks,
        completed: completedTasks,
      },
    });
  } catch (error) {
    console.error("获取订单失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}

// 接收订单
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (!["factory_admin", "super_admin"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const supabase = getSupabaseClient();
    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: "缺少 order_id" }, { status: 400 });
    }

    // 更新订单状态 - 仅更新 orders 表中存在的列
    const { error } = await supabase
      .from("orders")
      .update({
        status: "confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .eq("target_factory_id", user.tenant_id || "");

    if (error) {
      console.error("接收订单失败:", error);
      return NextResponse.json({ success: false, error: "接收失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "订单已接收" });
  } catch (error) {
    console.error("接收订单失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
