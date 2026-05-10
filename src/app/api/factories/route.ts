import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/db/client";
import { getUserFromRequest } from "@/lib/auth";

interface FactoryRow {
  id: string;
  name: string;
  type: string;
  contact_person: string | null;
  contact_phone: string | null;
  address: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    if (!["dealer_admin", "super_admin", "saas_admin"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "无权限访问" }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, type, contact_person, contact_phone, address, status, created_at, updated_at")
      .eq("type", "factory")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("获取工厂列表失败:", error);
      return NextResponse.json({ success: false, error: "获取失败" }, { status: 500 });
    }

    const factories = ((data || []) as FactoryRow[]).map((factory) => ({
      id: factory.id,
      name: factory.name,
      type: factory.type,
      contact_person: factory.contact_person,
      contact_phone: factory.contact_phone,
      address: factory.address,
      status: factory.status,
      created_at: factory.created_at,
      updated_at: factory.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: factories,
      factories,
    });
  } catch (error) {
    console.error("获取工厂列表失败:", error);
    return NextResponse.json({ success: false, error: "服务器错误" }, { status: 500 });
  }
}
