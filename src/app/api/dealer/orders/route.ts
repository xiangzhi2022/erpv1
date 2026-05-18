import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessPath, isSuperAdmin } from "@/lib/role-access";
import { mapInternalStatusToDealerStatus } from "@/lib/permission-utils";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    // 权限检查：经销商管理员或系统管理员可访问
    if (!canAccessPath(user, "/dealer")) {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    // 构建订单查询 — 字段与 Drizzle schema 对齐
    let query = supabase
      .from("orders")
      .select("id, order_no, customer_name, status, delivery_date, remark, created_at, updated_at, tenant_id, dealer_id, from_tenant_id, to_tenant_id", { count: "exact" })
      .order("created_at", { ascending: false });

    // 权限过滤：经销商管理员只看自己租户的订单
    if (!isSuperAdmin(user)) {
      if (!user.tenant_id) {
        return NextResponse.json(
          { success: false, error: "用户未关联经销商租户" },
          { status: 400 }
        );
      }
      query = query.or(`tenant_id.eq.${user.tenant_id},dealer_id.eq.${user.tenant_id},from_tenant_id.eq.${user.tenant_id},to_tenant_id.eq.${user.tenant_id}`);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    // 状态过滤
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // 分页
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: orders, error, count } = await query;

    if (error) {
      console.error("获取订单失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    const orderList = (orders || []).map((order: Record<string, unknown>) => ({
      id: order.id,
      order_no: order.order_no,
      customer_name: order.customer_name,
      status: order.status,
      external_status: mapInternalStatusToDealerStatus(String(order.status || "")),
      progress: mapInternalStatusToDealerStatus(String(order.status || "")),
      expected_ship_date: order.delivery_date,
      shipping_status: order.status === "shipped" ? "已发货" : order.status === "ready_to_ship" ? "待发货" : "未发货",
      logistics: null,
      remark: order.remark,
      created_at: order.created_at,
      updated_at: order.updated_at,
    }));

    // 统计
    const statusStats = {
      pending: orderList.filter((o: Record<string, unknown>) => o.status === "pending").length,
      confirmed: orderList.filter((o: Record<string, unknown>) => o.status === "confirmed").length,
      producing: orderList.filter((o: Record<string, unknown>) => o.status === "producing").length,
      shipped: orderList.filter((o: Record<string, unknown>) => o.status === "shipped").length,
      completed: orderList.filter((o: Record<string, unknown>) => o.status === "completed").length,
    };

    return NextResponse.json({
      success: true,
      orders: orderList,
      stats: statusStats,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error("获取订单失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
