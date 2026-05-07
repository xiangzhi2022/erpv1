import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

    // 计算负荷率
    const loadPercentage =
      workshop.capacity && Number(workshop.capacity) > 0
        ? Math.round((Number(workshop.current_load) / Number(workshop.capacity)) * 100)
        : 0;

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
      !["normal", "maintenance", "stopped"].includes(body.status)
    ) {
      return NextResponse.json(
        { success: false, error: "无效的状态值" },
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
        let value = body[field];
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

    const queryParams = new URLSearchParams({
      id: `eq.${id}`,
    });
    const apiUrl = `${getSupabaseUrl()}/factory_workshops?${queryParams.toString()}`;
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

    // 计算负荷率
    const loadPercentage =
      workshop.capacity && Number(workshop.capacity) > 0
        ? Math.round((Number(workshop.current_load) / Number(workshop.capacity)) * 100)
        : 0;

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

    const queryParams = new URLSearchParams({
      id: `eq.${id}`,
    });
    const apiUrl = `${getSupabaseUrl()}/factory_workshops?${queryParams.toString()}`;
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
