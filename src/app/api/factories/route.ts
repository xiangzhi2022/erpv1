import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    // 经销商、工厂管理员和超管均可查看工厂列表（工厂门户复用）
    if (!["dealer_admin", "factory_admin", "super_admin"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    // 获取所有活跃工厂租户 - 仅使用 tenants 表中存在的字段
    const { data: factories, error } = await supabase
      .from("tenants")
      .select("id, name, type, contact_person, contact_phone, address, status")
      .eq("type", "factory")
      .eq("status", "active");

    if (error) {
      console.error("获取工厂列表失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    // 获取每个工厂的订单数作为负载指标
    const factoryIds = (factories || []).map((f: Record<string, unknown>) => f.id as string);

    interface FactoryLoad {
      total_orders: number;
      producing_orders: number;
    }

    const factoryLoadMap = new Map<string, FactoryLoad>();

    if (factoryIds.length > 0) {
      const { data: orderCounts } = await supabase
        .from("orders")
        .select("target_factory_id, status")
        .in("target_factory_id", factoryIds);

      (orderCounts || []).forEach((o: Record<string, unknown>) => {
        const factoryId = o.target_factory_id as string;
        const load = factoryLoadMap.get(factoryId) || { total_orders: 0, producing_orders: 0 };
        load.total_orders++;
        if (o.status === "producing") load.producing_orders++;
        factoryLoadMap.set(factoryId, load);
      });
    }

    const factoryList = (factories || []).map((f: Record<string, unknown>) => {
      const load = factoryLoadMap.get(f.id as string) || { total_orders: 0, producing_orders: 0 };
      return {
        id: f.id,
        name: f.name,
        contact_person: f.contact_person,
        contact_phone: f.contact_phone,
        address: f.address,
        total_orders: load.total_orders,
        producing_orders: load.producing_orders,
      };
    });

    // 按生产中订单数从低到高排序（智能推荐）
    factoryList.sort((a, b) => a.producing_orders - b.producing_orders);

    return NextResponse.json({
      success: true,
      factories: factoryList,
    });
  } catch (error) {
    console.error("获取工厂列表失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
