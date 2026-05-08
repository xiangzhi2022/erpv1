// ===================== OAuth Provider 配置 =====================

export type OAuthProvider = 'wechat' | 'github' | 'google';

export interface OAuthProviderConfig {
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  icon: string; // SVG path or identifier
}

export const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthProviderConfig> = {
  wechat: {
    name: '微信',
    authorizeUrl: 'https://open.weixin.qq.com/connect/qrconnect',
    tokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
    userinfoUrl: 'https://api.weixin.qq.com/sns/userinfo',
    scope: 'snsapi_login',
    clientIdEnv: 'WECHAT_OPEN_APP_ID',
    clientSecretEnv: 'WECHAT_OPEN_APP_SECRET',
    icon: 'wechat',
  },
  github: {
    name: 'GitHub',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userinfoUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    icon: 'github',
  },
  google: {
    name: 'Google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userinfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'openid profile email',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    icon: 'google',
  },
};

export function getOAuthProvider(provider: string): OAuthProviderConfig | null {
  return OAUTH_PROVIDERS[provider as OAuthProvider] ?? null;
}

export function isOAuthProviderConfigured(provider: OAuthProvider): boolean {
  const config = OAUTH_PROVIDERS[provider];
  return !!(
    process.env[config.clientIdEnv] &&
    process.env[config.clientSecretEnv]
  );
}
