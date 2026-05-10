import { NextRequest, NextResponse } from 'next/server';
import { getOAuthProvider, isOAuthProviderConfigured } from '@/lib/oauth';
import { generateOAuthState } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const config = getOAuthProvider(provider);

  if (!config) {
    return NextResponse.json(
      { success: false, error: `不支持的 OAuth 提供商: ${provider}` },
      { status: 400 }
    );
  }

  // 检查是否已配置
  if (!isOAuthProviderConfigured(provider as 'wechat' | 'github' | 'google')) {
    return NextResponse.json(
      {
        success: false,
        error: 'OAuth 未配置',
        message: `请先配置 ${config.name} OAuth 所需的环境变量: ${config.clientIdEnv} 和 ${config.clientSecretEnv}`,
        provider,
        requiredEnvVars: [config.clientIdEnv, config.clientSecretEnv],
      },
      { status: 503 }
    );
  }

  const clientId = process.env[config.clientIdEnv]!;
  const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
  const redirectUri = `${domain}/api/auth/oauth/${provider}/callback`;
  const redirectUrl = request.nextUrl.searchParams.get('redirect') || '/';
  const state = generateOAuthState(provider, redirectUrl);

  // 构建授权 URL
  let authorizeUrl: string;

  if (provider === 'wechat') {
    // 微信扫码登录使用独立的 URL 格式
    authorizeUrl = `${config.authorizeUrl}?appid=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${config.scope}&state=${state}#wechat_redirect`;
  } else {
    authorizeUrl = `${config.authorizeUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(config.scope)}&state=${state}`;
  }

  return NextResponse.redirect(authorizeUrl);
}
