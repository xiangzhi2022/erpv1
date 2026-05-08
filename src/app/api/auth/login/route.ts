import { NextRequest, NextResponse } from 'next/server';
import { verifyCaptcha, authenticateUser, createSession, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account, password, captchaId, captchaCode, rememberMe } = body as {
      account?: string;
      password?: string;
      captchaId?: string;
      captchaCode?: string;
      rememberMe?: boolean;
    };

    // 参数校验
    if (!account || !password) {
      return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
    }

    // 验证码校验（测试环境可跳过：设置 SKIP_CAPTCHA=1）
    const skipCaptcha = process.env.SKIP_CAPTCHA === '1';
    if (!skipCaptcha) {
      if (!captchaId || !captchaCode) {
        return NextResponse.json({ error: '请输入验证码' }, { status: 400 });
      }
      if (!verifyCaptcha(captchaId, captchaCode)) {
        return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
      }
    }

    // 用户认证
    const user = authenticateUser(account, password);
    if (!user) {
      return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
    }

    // 创建会话
    const sessionId = await createSession(user);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar, provider: user.provider },
    });

    // 设置会话 Cookie
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60; // 记住我7天，否则1天
    response.headers.set(
      'Set-Cookie',
      `auth_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
    );

    return response;
  } catch {
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
