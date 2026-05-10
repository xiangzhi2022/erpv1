import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession, buildClearSessionCookie, isProduction, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    // 清除服务端会话
    if (sessionId) {
      deleteSession(sessionId);
    }

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', buildClearSessionCookie(isProduction()));

    return response;
  } catch {
    return NextResponse.json({ success: false, error: '退出登录失败' }, { status: 500 });
  }
}
