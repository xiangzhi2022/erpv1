import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (!["dealer_admin", "super_admin"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    // 获取经销商的订单
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        *,
        factory:tenants!orders_target_factory_id_fkey(id, name),
        items:order_items(id, product_name, quantity, subtotal),
        tasks:production_tasks(id, station, progress)
      `)
      .eq("dealer_id", user.tenant_id || "")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取订单失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    const orderList = orders || [];

    // 计算每个订单的进度
    const ordersWithProgress = orderList.map((o: any) => {
      const totalTasks = o.tasks?.length || 0;
      const completedTasks = o.tasks?.filter((t: any) => t.progress === "completed").length || 0;
      return {
        ...o,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
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
