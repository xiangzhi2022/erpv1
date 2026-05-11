import { NextRequest, NextResponse } from 'next/server';
import {
  verifyCaptcha,
  authenticateUser,
  createSession,
  buildSessionCookie,
  isProduction,
} from '@/lib/auth';
import { getLandingPath } from '@/lib/role-access';

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
      return NextResponse.json({ success: false, error: '请输入账号和密码' }, { status: 400 });
    }

    // 验证码校验（开发环境可跳过：设置 SKIP_CAPTCHA=1）
    const skipCaptcha = process.env.SKIP_CAPTCHA === '1';
    if (!skipCaptcha) {
      if (!captchaId || !captchaCode) {
        return NextResponse.json({ success: false, error: '请输入验证码' }, { status: 400 });
      }
      if (!verifyCaptcha(captchaId, captchaCode)) {
        return NextResponse.json({ success: false, error: '验证码错误或已过期' }, { status: 400 });
      }
    }

    // 用户认证（先查内存 store，再查 Supabase）
    const user = await authenticateUser(account, password);
    if (!user) {
      return NextResponse.json({ success: false, error: '账号或密码错误' }, { status: 401 });
    }

    // 创建会话（记住我 7 天，否则 1 天）
    const maxAgeMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const maxAgeSec = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    const sessionId = await createSession(user, maxAgeMs);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        provider: user.provider,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_type: user.tenant_type,
        permissions: user.permissions || [],
      },
      redirectTo: getLandingPath(user),
    });

    // 设置会话 Cookie（统一使用 buildSessionCookie）
    response.headers.set(
      'Set-Cookie',
      buildSessionCookie(sessionId, { maxAge: maxAgeSec, secure: isProduction() })
    );

    return response;
  } catch {
    return NextResponse.json({ success: false, error: '服务器内部错误' }, { status: 500 });
  }
}
