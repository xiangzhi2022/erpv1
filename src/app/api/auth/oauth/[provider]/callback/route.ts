import { NextRequest, NextResponse } from 'next/server';
import { getOAuthProvider, isOAuthProviderConfigured } from '@/lib/oauth';
import { verifyOAuthState, findOrCreateOAuthUser, createSession, buildSessionCookie, isProduction } from '@/lib/auth';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface WechatUser {
  openid: string;
  nickname: string;
  headimgurl: string;
  unionid?: string;
}

// 交换授权码获取 access_token
async function exchangeCodeForToken(
  provider: string,
  code: string,
  redirectUri: string
): Promise<string> {
  const config = getOAuthProvider(provider);
  if (!config) throw new Error(`不支持的 provider: ${provider}`);

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) throw new Error(`${config.name} OAuth 未配置`);

  let tokenRes: Response;

  if (provider === 'github') {
    tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
  } else if (provider === 'google') {
    tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
  } else if (provider === 'wechat') {
    tokenRes = await fetch(
      `${config.tokenUrl}?appid=${clientId}&secret=${clientSecret}&code=${code}&grant_type=authorization_code`
    );
  } else {
    throw new Error(`不支持的 provider: ${provider}`);
  }

  if (!tokenRes.ok) {
    // 不暴露具体错误内容
    throw new Error(`获取 access_token 失败`);
  }

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error(`获取 access_token 失败`);
  }

  return tokenData.access_token;
}

// 获取用户信息
async function fetchUserInfo(provider: string, accessToken: string): Promise<{ id: string; name: string; email?: string; avatar?: string }> {
  const config = getOAuthProvider(provider);
  if (!config) throw new Error(`不支持的 provider: ${provider}`);

  const userRes = await fetch(config.userinfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!userRes.ok) {
    throw new Error(`获取用户信息失败`);
  }

  const userData = await userRes.json();

  if (provider === 'github') {
    const gh = userData as GitHubUser;
    return {
      id: String(gh.id),
      name: gh.name || gh.login,
      email: gh.email || undefined,
      avatar: gh.avatar_url,
    };
  }

  if (provider === 'google') {
    const gl = userData as GoogleUser;
    return {
      id: gl.id,
      name: gl.name,
      email: gl.email,
      avatar: gl.picture,
    };
  }

  if (provider === 'wechat') {
    const wx = userData as WechatUser;
    return {
      id: wx.openid,
      name: wx.nickname,
      avatar: wx.headimgurl,
    };
  }

  throw new Error(`不支持的 provider: ${provider}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const config = getOAuthProvider(provider);

  if (!config) {
    return NextResponse.redirect(new URL('/login?error=oauth_unsupported_provider', request.url));
  }

  if (!isOAuthProviderConfigured(provider as 'wechat' | 'github' | 'google')) {
    return NextResponse.redirect(new URL('/login?error=oauth_not_configured', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=oauth_missing_params', request.url));
  }

  // 验证 state
  const stateData = verifyOAuthState(state);
  if (!stateData || stateData.provider !== provider) {
    return NextResponse.redirect(new URL('/login?error=oauth_invalid_state', request.url));
  }

  try {
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
    const redirectUri = `${domain}/api/auth/oauth/${provider}/callback`;

    // 1. 交换 token
    const accessToken = await exchangeCodeForToken(provider, code, redirectUri);

    // 2. 获取用户信息
    const profile = await fetchUserInfo(provider, accessToken);

    // 3. 查找或创建用户
    const user = findOrCreateOAuthUser(provider, profile.id, profile);

    // 4. 创建会话
    const sessionId = await createSession(user);

    // 5. 重定向到目标页面，附带会话 Cookie
    const redirectUrl = stateData.redirectUrl || '/';
    const response = NextResponse.redirect(new URL(redirectUrl, request.url));
    response.headers.set(
      'Set-Cookie',
      buildSessionCookie(sessionId, { secure: isProduction() })
    );

    return response;
  } catch (err) {
    // 仅记录详细错误到服务端日志，不暴露给客户端
    const message = err instanceof Error ? err.message : 'OAuth 登录失败';
    console.error(`OAuth callback error [${provider}]:`, message);
    return NextResponse.redirect(new URL('/login?error=oauth_login_failed', request.url));
  }
}
