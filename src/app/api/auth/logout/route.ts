import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_session')?.value;

    if (sessionId) {
      // 清除服务端会话（内存存储中无需额外操作，Cookie 清除即可）
    }

    const response = NextResponse.json({ success: true });
    response.headers.set(
      'Set-Cookie',
      'auth_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    );

    return response;
  } catch {
    return NextResponse.json({ error: '退出登录失败' }, { status: 500 });
  }
}
