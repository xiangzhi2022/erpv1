import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

interface FactoryRow {
  id: string;
  name: string | null;
  type: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  address: string | null;
  status: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface FactoryLoad {
  total_orders: number;
  producing_orders: number;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    // 经销商、工厂管理员和平台管理员均可查看工厂列表（订单分配与工厂门户复用）。
    if (!["dealer_admin", "factory_admin", "super_admin", "saas_admin"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    const { data: factories, error } = await supabase
      .from("tenants")
      .select("id, name, type, contact_person, contact_phone, address, status, created_at, updated_at")
      .eq("type", "factory")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取工厂列表失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    const factoryRows = (factories || []) as FactoryRow[];
    const factoryIds = factoryRows.map((factory) => factory.id);
    const factoryLoadMap = new Map<string, FactoryLoad>();

    if (factoryIds.length > 0) {
      const { data: orderCounts, error: orderError } = await supabase
        .from("orders")
        .select("target_factory_id, status")
        .in("target_factory_id", factoryIds);

      if (orderError) {
        console.warn("获取工厂负载失败，使用空负载:", orderError);
      }

      (orderCounts || []).forEach((order: Record<string, unknown>) => {
        const factoryId = String(order.target_factory_id || "");
        if (!factoryId) return;
        const load = factoryLoadMap.get(factoryId) || { total_orders: 0, producing_orders: 0 };
        load.total_orders += 1;
        if (order.status === "producing" || order.status === "in_production") {
          load.producing_orders += 1;
        }
        factoryLoadMap.set(factoryId, load);
      });
    }

    const factoryList = factoryRows
      .map((factory) => {
        const load = factoryLoadMap.get(factory.id) || { total_orders: 0, producing_orders: 0 };
        return {
          id: factory.id,
          name: factory.name,
          type: factory.type,
          contact_person: factory.contact_person,
          contact_phone: factory.contact_phone,
          address: factory.address,
          status: factory.status,
          created_at: factory.created_at || null,
          updated_at: factory.updated_at || null,
          total_orders: load.total_orders,
          producing_orders: load.producing_orders,
        };
      })
      .sort((a, b) => a.producing_orders - b.producing_orders);

    return NextResponse.json({
      success: true,
      data: factoryList,
      factories: factoryList,
    });
  } catch (error) {
    console.error("获取工厂列表失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
