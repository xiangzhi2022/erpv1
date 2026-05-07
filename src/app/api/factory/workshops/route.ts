import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

function getSupabaseHeaders(): Record<string, string> {
  const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
  return {
    "Content-Type": "application/json",
    apikey: serviceKey || "",
    Authorization: `Bearer ${serviceKey}`,
    Prefer: "return=representation",
  };
}

function getSupabaseUrl(): string {
  return `${process.env.COZE_SUPABASE_URL}/rest/v1`;
}

/**
 * GET /api/factory/workshops
 * 获取车间列表，支持按状态、名称搜索过滤
 */
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    if (!["factory_admin", "super_admin", "saas_admin", "dealer_admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "无权限访问" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const keyword = searchParams.get("keyword");

    // 构建查询参数
    const queryParams = new URLSearchParams({
      select: "*",
      order: "created_at.asc",
    });

    if (status && status !== "all") {
      queryParams.set("status", `eq.${status}`);
    }

    if (keyword) {
      queryParams.set(
        "or",
        `(name.ilike.%${keyword}%,factory_code.ilike.%${keyword}%,manager.ilike.%${keyword}%,location.ilike.%${keyword}%)`
      );
    }

    const apiUrl = `${getSupabaseUrl()}/factory_workshops?${queryParams.toString()}`;
    const response = await fetch(apiUrl, {
      headers: getSupabaseHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`查询失败: ${error}`);
    }

    const workshops = (await response.json()) as Record<string, unknown>[];

    // 计算负荷率
    const enriched: Record<string, unknown>[] = (workshops || []).map((w) => ({
      ...w,
      load_percentage:
        w.capacity && Number(w.capacity) > 0
          ? Math.round((Number(w.current_load) / Number(w.capacity)) * 100)
          : 0,
    }));

    // 统计数据
    const stats = {
      total: enriched.length,
      normal: enriched.filter((w) => w.status === "normal").length,
      maintenance: enriched.filter((w) => w.status === "maintenance").length,
      stopped: enriched.filter((w) => w.status === "stopped").length,
      totalCapacity: enriched.reduce(
        (sum, w) => sum + Number(w.capacity || 0),
        0
      ),
      totalLoad: enriched.reduce(
        (sum, w) => sum + Number(w.current_load || 0),
        0
      ),
    };

    return NextResponse.json({
      success: true,
      workshops: enriched,
      stats,
    });
  } catch (error) {
    console.error("获取车间列表失败:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/factory/workshops
 * 新增车间
 */
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    if (!["factory_admin", "super_admin", "saas_admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "无权限操作" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { factory_code, name, location, manager, capacity, description } =
      body;

    if (!factory_code || !name) {
      return NextResponse.json(
        { success: false, error: "车间编号和名称为必填项" },
        { status: 400 }
      );
    }

    // 编号格式校验：字母+数字+连字符
    const codeRegex = /^[A-Za-z]+-[A-Za-z0-9]+$/;
    if (!codeRegex.test(factory_code)) {
      return NextResponse.json(
        {
          success: false,
          error: "车间编号格式不正确，需为字母-数字格式，如 WH-A01",
        },
        { status: 400 }
      );
    }

    // 检查编号是否重复
    const checkParams = new URLSearchParams({
      select: "id",
      factory_code: `eq.${factory_code}`,
    });
    const checkUrl = `${getSupabaseUrl()}/factory_workshops?${checkParams.toString()}`;
    const checkResponse = await fetch(checkUrl, {
      headers: getSupabaseHeaders(),
    });
    const existing = (await checkResponse.json()) as Record<string, unknown>[];

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "该车间编号已存在" },
        { status: 409 }
      );
    }

    // 插入数据
    const insertPayload = {
      factory_code,
      name,
      location: location || null,
      manager: manager || null,
      capacity: Number(capacity) || 0,
      current_load: 0,
      status: "normal",
      description: description || null,
    };

    const insertUrl = `${getSupabaseUrl()}/factory_workshops`;
    const insertResponse = await fetch(insertUrl, {
      method: "POST",
      headers: getSupabaseHeaders(),
      body: JSON.stringify(insertPayload),
    });

    if (!insertResponse.ok) {
      const error = await insertResponse.text();
      throw new Error(`创建失败: ${error}`);
    }

    const workshop = (await insertResponse.json()) as Record<string, unknown>;
    // POST with return=representation returns array or single object
    const result = Array.isArray(workshop) ? workshop[0] : workshop;

    return NextResponse.json({ success: true, workshop: result }, { status: 201 });
  } catch (error) {
    console.error("创建车间失败:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 }
    );
  }
}
