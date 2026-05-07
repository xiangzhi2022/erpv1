import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";
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

    // 获取本工厂的订单
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        *,
        dealer:tenants!orders_dealer_id_fkey(id, name),
        items:order_items(id, product_name, quantity, subtotal)
      `)
      .eq("target_factory_id", user.tenant_id || "")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取订单失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    const orderList = orders || [];

    // 获取订单对应的生产任务
    const orderIds = orderList.map((o: any) => o.id);
    let taskStats: { order_id: string; total: number; completed: number }[] = [];
    
    if (orderIds.length > 0) {
      const { data: tasks } = await supabase
        .from("production_tasks")
        .select("order_id, progress")
        .in("order_id", orderIds);
      
      const taskMap = new Map<string, { total: number; completed: number }>();
      (tasks || []).forEach((t: any) => {
        const stats = taskMap.get(t.order_id) || { total: 0, completed: 0 };
        stats.total++;
        if (t.progress === "completed") stats.completed++;
        taskMap.set(t.order_id, stats);
      });
      
      taskStats = Array.from(taskMap.entries()).map(([order_id, stats]) => ({
        order_id,
        ...stats,
      }));
    }

    // 合并数据
    const ordersWithProgress = orderList.map((o: any) => {
      const stats = taskStats.find(s => s.order_id === o.id) || { total: 0, completed: 0 };
      return {
        ...o,
        total_tasks: stats.total,
        completed_tasks: stats.completed,
        progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      };
    });

    // 统计
    const statusStats = {
      pending: ordersWithProgress.filter((o: any) => o.status === "pending").length,
      confirmed: ordersWithProgress.filter((o: any) => o.status === "confirmed").length,
      producing: ordersWithProgress.filter((o: any) => o.status === "producing").length,
      shipped: ordersWithProgress.filter((o: any) => o.status === "shipped").length,
      completed: ordersWithProgress.filter((o: any) => o.status === "completed").length,
    };

    return NextResponse.json({ 
      success: true, 
      orders: ordersWithProgress,
      stats: statusStats,
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

    // 更新订单状态
    const { error } = await supabase
      .from("orders")
      .update({ 
        status: "confirmed",
        received_at: new Date().toISOString(),
        received_by: user.id,
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
