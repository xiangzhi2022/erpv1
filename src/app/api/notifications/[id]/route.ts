import { NextResponse } from "next/server";
import { markNotificationRead } from "@/app/actions/tasks";

// PATCH /api/notifications/[id] - 标记单个通知为已读
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await markNotificationRead(id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "操作失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
