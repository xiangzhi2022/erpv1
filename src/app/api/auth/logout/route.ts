import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('current_user');

    return Response.json({ success: true, message: '已退出登录' });
  } catch (err) {
    console.error('Logout error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
