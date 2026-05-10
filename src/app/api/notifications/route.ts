import { NextResponse } from "next/server";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  checkOverdueTasks,
} from "@/app/actions/tasks";

// GET /api/notifications - 查询通知列表
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const readStr = searchParams.get("read");
    const read = readStr !== null ? readStr === "true" : undefined;
    const type = searchParams.get("type") ?? undefined;
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? Number(limitStr) : undefined;

    const [notifications, unreadCount] = await Promise.all([
      getNotifications({ read, type, limit }),
      getUnreadNotificationCount(),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "查询通知失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/notifications - 标记所有通知为已读 / 触发过期检查
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "markAllRead") {
      const count = await markAllNotificationsRead();
      return NextResponse.json({ success: true, markedCount: count });
    }

    if (body.action === "checkOverdue") {
      const count = await checkOverdueTasks();
      return NextResponse.json({ success: true, newNotifications: count });
    }

    return NextResponse.json(
      { success: false, error: "未知操作" },
      { status: 400 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "操作失败";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
