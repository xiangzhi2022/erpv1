import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

/** 合法的车间状态值 */
const VALID_STATUSES = ["normal", "maintenance", "stopped"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

function getSupabaseHeaders(
  options?: { prefer?: string }
): Record<string, string> {
  const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
  return {
    "Content-Type": "application/json",
    apikey: serviceKey || "",
    Authorization: `Bearer ${serviceKey}`,
    Prefer: options?.prefer ?? "return=representation",
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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/factory/workshops/[id]
 * 获取单个车间详情
 */
export async function GET(request: Request, { params }: RouteContext) {
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

    const { id } = await params;

    const queryParams = new URLSearchParams({
      select: "*",
      id: `eq.${id}`,
    });
    const apiUrl = `${getSupabaseUrl()}/factory_workshops?${queryParams.toString()}`;
    const response = await fetch(apiUrl, {
      headers: getSupabaseHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`查询失败: ${error}`);
    }

    const workshops = (await response.json()) as Record<string, unknown>[];
    const workshop = workshops?.[0] || null;

    if (!workshop) {
      return NextResponse.json(
        { success: false, error: "车间不存在" },
        { status: 404 }
      );
    }

    // 计算负荷率（上限 100）
    const loadPercentage = calcLoadPercentage(
      Number(workshop.current_load || 0),
      Number(workshop.capacity || 0)
    );

    return NextResponse.json({
      success: true,
      workshop: { ...workshop, load_percentage: loadPercentage },
    });
  } catch (error) {
    console.error("获取车间详情失败:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/factory/workshops/[id]
 * 更新车间信息
 */
export async function PUT(request: Request, { params }: RouteContext) {
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

    const { id } = await params;
    const body = await request.json();

    // 状态值校验
    if (
      body.status !== undefined &&
      !VALID_STATUSES.includes(body.status as ValidStatus)
    ) {
      return NextResponse.json(
        { success: false, error: "无效的状态值，允许: normal, maintenance, stopped" },
        { status: 400 }
      );
    }

    // 产能与负荷校验
    const capacity = body.capacity !== undefined ? Number(body.capacity) : undefined;
    const currentLoad = body.current_load !== undefined ? Number(body.current_load) : undefined;

    if (capacity !== undefined && (isNaN(capacity) || capacity < 0)) {
      return NextResponse.json(
        { success: false, error: "产能为非负整数" },
        { status: 400 }
      );
    }
    if (currentLoad !== undefined && (isNaN(currentLoad) || currentLoad < 0)) {
      return NextResponse.json(
        { success: false, error: "负荷为非负整数" },
        { status: 400 }
      );
    }

    // 先查询当前记录，确保存在且用于负荷校验
    const queryParams = new URLSearchParams({
      select: "id,capacity,current_load",
      id: `eq.${id}`,
    });
    const checkUrl = `${getSupabaseUrl()}/factory_workshops?${queryParams.toString()}`;
    const checkResponse = await fetch(checkUrl, {
      headers: getSupabaseHeaders({ prefer: "" }),
    });
    const existing = (await checkResponse.json()) as Record<string, unknown>[];
    if (!existing || existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "车间不存在" },
        { status: 404 }
      );
    }

    // 校验 current_load <= capacity（用最终值）
    const finalCapacity = capacity ?? Number(existing[0].capacity || 0);
    const finalLoad = currentLoad ?? Number(existing[0].current_load || 0);
    if (finalLoad > finalCapacity) {
      return NextResponse.json(
        { success: false, error: "当前负荷不能超过产能" },
        { status: 400 }
      );
    }

    const allowedFields = [
      "name",
      "location",
      "manager",
      "capacity",
      "current_load",
      "status",
      "description",
    ];

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        let value: unknown = body[field];
        if (field === "capacity") value = Number(value) || 0;
        if (field === "current_load") value = Number(value) || 0;
        if (value === "") value = null;
        updatePayload[field] = value;
      }
    }

    if (Object.keys(updatePayload).length <= 1) {
      // 只有 updated_at
      return NextResponse.json(
        { success: false, error: "没有需要更新的字段" },
        { status: 400 }
      );
    }

    const patchParams = new URLSearchParams({
      id: `eq.${id}`,
    });
    const apiUrl = `${getSupabaseUrl()}/factory_workshops?${patchParams.toString()}`;
    const response = await fetch(apiUrl, {
      method: "PATCH",
      headers: getSupabaseHeaders(),
      body: JSON.stringify(updatePayload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`更新失败: ${error}`);
    }

    const updated = (await response.json()) as Record<string, unknown>[];
    const workshop = updated?.[0] || null;

    if (!workshop) {
      return NextResponse.json(
        { success: false, error: "车间不存在" },
        { status: 404 }
      );
    }

    // 计算负荷率（上限 100）
    const loadPercentage = calcLoadPercentage(
      Number(workshop.current_load || 0),
      Number(workshop.capacity || 0)
    );

    return NextResponse.json({
      success: true,
      workshop: { ...workshop, load_percentage: loadPercentage },
    });
  } catch (error) {
    console.error("更新车间失败:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/factory/workshops/[id]
 * 删除车间
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    // 仅超级管理员和SaaS管理员可删除
    if (!["super_admin", "saas_admin"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "仅管理员可删除车间" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 先检查车间是否存在
    const checkParams = new URLSearchParams({
      select: "id,name",
      id: `eq.${id}`,
    });
    const checkUrl = `${getSupabaseUrl()}/factory_workshops?${checkParams.toString()}`;
    const checkResponse = await fetch(checkUrl, {
      headers: getSupabaseHeaders({ prefer: "" }),
    });
    const existing = (await checkResponse.json()) as Record<string, unknown>[];
    if (!existing || existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "车间不存在" },
        { status: 404 }
      );
    }

    // 检查是否有关联的工单
    const orderCheckParams = new URLSearchParams({
      select: "id",
      workshop_id: `eq.${id}`,
      limit: "1",
    });
    const orderCheckUrl = `${getSupabaseUrl()}/work_orders?${orderCheckParams.toString()}`;
    const orderCheckResponse = await fetch(orderCheckUrl, {
      headers: getSupabaseHeaders({ prefer: "" }),
    });
    if (orderCheckResponse.ok) {
      const relatedOrders = (await orderCheckResponse.json()) as Record<string, unknown>[];
      if (relatedOrders && relatedOrders.length > 0) {
        return NextResponse.json(
          { success: false, error: "该车间存在关联的生产工单，无法删除" },
          { status: 409 }
        );
      }
    }

    const deleteParams = new URLSearchParams({
      id: `eq.${id}`,
    });
    const apiUrl = `${getSupabaseUrl()}/factory_workshops?${deleteParams.toString()}`;
    const response = await fetch(apiUrl, {
      method: "DELETE",
      headers: getSupabaseHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`删除失败: ${error}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除车间失败:", error);
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 }
    );
  }
}
