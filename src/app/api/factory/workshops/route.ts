import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { canAccessPath, isSuperAdmin } from "@/lib/role-access";

/** 合法的车间状态值 */
const VALID_STATUSES = ["normal", "maintenance", "stopped"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

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
 * 计算负荷百分比，上限 100
 */
function calcLoadPercentage(currentLoad: number, capacity: number): number {
  if (!capacity || capacity <= 0) return 0;
  return Math.min(Math.round((currentLoad / capacity) * 100), 100);
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

    if (!canAccessPath(user, "/factory") && !canAccessPath(user, "/progress")) {
      return NextResponse.json(
        { success: false, error: "无权限访问" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const keyword = searchParams.get("keyword");

    // 校验 status 参数合法性
    if (status && status !== "all" && !VALID_STATUSES.includes(status as ValidStatus)) {
      return NextResponse.json(
        { success: false, error: `无效的状态筛选值: ${status}` },
        { status: 400 }
      );
    }

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

    // 计算负荷率（上限 100）
    const enriched: Record<string, unknown>[] = (workshops || []).map((w) => ({
      ...w,
      load_percentage: calcLoadPercentage(
        Number(w.current_load || 0),
        Number(w.capacity || 0)
      ),
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

    if (!isSuperAdmin(user) && user.role !== "factory_admin") {
      return NextResponse.json(
        { success: false, error: "无权限操作" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { factory_code, name, location, manager, capacity, current_load, status, description } =
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

    // 产能与负荷校验
    const cap = Number(capacity) || 0;
    const load = Number(current_load) || 0;
    if (cap < 0) {
      return NextResponse.json(
        { success: false, error: "产能不能为负数" },
        { status: 400 }
      );
    }
    if (load < 0) {
      return NextResponse.json(
        { success: false, error: "负荷不能为负数" },
        { status: 400 }
      );
    }
    if (load > cap) {
      return NextResponse.json(
        { success: false, error: "当前负荷不能超过产能" },
        { status: 400 }
      );
    }

    // 状态校验
    const initialStatus = status && VALID_STATUSES.includes(status as ValidStatus)
      ? status
      : "normal";

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
      capacity: cap,
      current_load: load,
      status: initialStatus,
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

    // 补充负荷率字段
    const enrichedResult = {
      ...result,
      load_percentage: calcLoadPercentage(
        Number(result.current_load || 0),
        Number(result.capacity || 0)
      ),
    };

    return NextResponse.json({ success: true, workshop: enrichedResult }, { status: 201 });
  } catch (error) {
    console.error("创建车间失败:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 }
    );
  }
}
