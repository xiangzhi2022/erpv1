import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    // 经销商可以查看工厂负载
    if (!["dealer_admin", "super_admin"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    // 获取所有工厂及其配置
    const { data: factories, error } = await supabase
      .from("tenants")
      .select(`
        id, name, code, address, order_prefix,
        factory_config:factory_config!inner(current_load, max_load, is_accepting, avg_completion_days)
      `)
      .eq("type", "factory")
      .eq("status", "active");

    if (error) {
      console.error("获取工厂列表失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    const factoryList = (factories || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      code: f.code,
      address: f.address,
      order_prefix: f.order_prefix,
      current_load: f.factory_config?.[0]?.current_load || 0,
      max_load: f.factory_config?.[0]?.max_load || 100,
      is_accepting: f.factory_config?.[0]?.is_accepting ?? true,
      avg_completion_days: f.factory_config?.[0]?.avg_completion_days || 15,
      load_percentage: f.factory_config?.[0] ? 
        Math.round((f.factory_config[0].current_load / f.factory_config[0].max_load) * 100) : 0,
    }));

    // 按负载从低到高排序（智能推荐）
    factoryList.sort((a: any, b: any) => a.current_load - b.current_load);

    return NextResponse.json({ 
      success: true, 
      factories: factoryList,
    });
  } catch (error) {
    console.error("获取工厂列表失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
