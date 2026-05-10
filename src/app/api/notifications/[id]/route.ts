import { NextResponse } from "next/server";
import { markNotificationRead } from "@/app/actions/tasks";

// PATCH /api/notifications/[id] - 标记单个通知为已读
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const notification = await markNotificationRead(id);
    return NextResponse.json({ success: true, data: notification });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "操作失败";
    const status = message === "通知不存在" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
