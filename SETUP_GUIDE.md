# 认证系统配置指南

项目只使用 Supabase Auth 和 `@supabase/ssr`。密码、Session、邮箱/短信 OTP、
OAuth PKCE 以及密码重置令牌都由 Supabase 管理，应用不再保存自制密码
哈希、内存会话、验证码或 OAuth state。

## 本地环境变量

从 `.env.example` 创建本地配置，但不要提交真实值：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SUPABASE_SECRET_KEY=sb_secret_your_key
APP_URL=http://localhost:5000
```

`SUPABASE_SECRET_KEY` 只能在服务端使用。浏览器、日志、API 响应和仓库文件都
不得包含它。

## Supabase Dashboard

认证提供商、SMTP、短信、OAuth Client ID/Secret、Site URL 和回调白名单全部
在 Supabase Dashboard 配置，不再使用 `GITHUB_CLIENT_SECRET`、
`GOOGLE_CLIENT_SECRET`、`WECHAT_OPEN_APP_SECRET` 或自建 SMTP 发送路由。

当前应用 OAuth 白名单为 GitHub 和 Google。回调由 Supabase PKCE 流程返回：

```text
/api/auth/oauth/{provider}
  -> Supabase Auth provider authorization
  -> /auth/confirm?code=...
  -> exchangeCodeForSession
  -> safe in-site redirect
```

密码重置流程：

```text
/forgot-password
  -> supabase.auth.resetPasswordForEmail
  -> /auth/confirm?next=/reset-password
  -> verified recovery session
  -> supabase.auth.updateUser
```

正式发布前必须完成 [Supabase Auth production gate](docs/auth-production-gate.md)。
旧账号只能通过邀请或密码重置激活，不得复制旧密码哈希。可先运行
`pnpm legacy-auth:report` 生成不含个人数据的统计报告。
