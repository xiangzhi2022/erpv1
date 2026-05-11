import { NextRequest, NextResponse } from 'next/server';
import { consumeResetToken, updateUserPassword, updateUserPasswordInDB } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, confirmPassword } = body as {
      token?: string;
      password?: string;
      confirmPassword?: string;
    };

    // 参数校验
    if (!token) {
      return NextResponse.json({ success: false, error: '缺少重置令牌' }, { status: 400 });
    }
    if (!password || !confirmPassword) {
      return NextResponse.json({ success: false, error: '请输入新密码' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, error: '密码长度不能少于6位' }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ success: false, error: '两次输入的密码不一致' }, { status: 400 });
    }

    // 验证令牌
    const email = consumeResetToken(token);
    if (!email) {
      return NextResponse.json({ success: false, error: '重置链接已过期或无效，请重新申请' }, { status: 400 });
    }

    // 更新密码（先尝试内存 store，再尝试数据库）
    const memoryUpdated = updateUserPassword(email, password);
    const dbUpdated = await updateUserPasswordInDB(email, password);

    if (!memoryUpdated && !dbUpdated) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '密码重置成功，请使用新密码登录' });
  } catch {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
