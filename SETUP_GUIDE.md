# 登录系统配置指南

本文档说明登录系统各功能所需的环境变量与外部服务配置。

---

## 一、第三方 OAuth 登录

### 1. GitHub OAuth

**申请地址**: https://github.com/settings/developers → OAuth Apps → New OAuth App

| 步骤 | 说明 |
|------|------|
| Application name | 自定义，如 `My App` |
| Homepage URL | 你的站点首页，如 `https://your-domain.com` |
| Authorization callback URL | `{你的域名}/api/auth/oauth/github/callback` |

创建后获取 **Client ID** 和 **Client Secret**，配置环境变量：

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

---

### 2. Google OAuth

**申请地址**: https://console.cloud.google.com/apis/credentials

| 步骤 | 说明 |
|------|------|
| 创建项目 | 在 Google Cloud Console 创建项目 |
| 启用 API | APIs & Services → 启用 "Google+ API" |
| 创建凭据 | OAuth 2.0 Client ID → Web application |
| Authorized redirect URIs | `{你的域名}/api/auth/oauth/google/callback` |

创建后获取 **Client ID** 和 **Client Secret**，配置环境变量：

```env
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

### 3. 微信开放平台登录

**申请地址**: https://open.weixin.qq.com/

| 步骤 | 说明 |
|------|------|
| 注册账号 | 微信开放平台开发者账号（需企业资质） |
| 创建网站应用 | 管理中心 → 网站应用 → 创建网站应用 |
| 授权回调域 | 设置为你的域名（不含协议和路径），如 `your-domain.com` |

审核通过后获取 **AppID** 和 **AppSecret**，配置环境变量：

```env
WECHAT_OPEN_APP_ID=wx1234567890abcdef
WECHAT_OPEN_APP_SECRET=your_wechat_app_secret
```

> **注意**: 微信扫码登录仅支持 PC 端网站，需企业资质审核。个人开发者建议优先使用 GitHub 或 Google。

---

## 二、忘记密码（邮件服务）

### 方式一：SMTP 邮件（推荐）

支持任意 SMTP 服务，如 QQ 邮箱、163 邮箱、阿里企业邮箱、SendGrid 等。

```env
SMTP_HOST=smtp.example.com        # SMTP 服务器地址
SMTP_PORT=587                     # 端口（587=TLS, 465=SSL）
SMTP_USER=noreply@example.com     # 发件人邮箱
SMTP_PASS=your_smtp_password      # 邮箱授权码（非登录密码）
SMTP_FROM_NAME=系统通知            # 发件人显示名称（可选）
```

**常见 SMTP 配置**:

| 邮箱服务 | SMTP_HOST | SMTP_PORT | 备注 |
|----------|-----------|-----------|------|
| QQ 邮箱 | smtp.qq.com | 587 | 需开启 SMTP 并获取授权码 |
| 163 邮箱 | smtp.163.com | 465 | 需开启 SMTP 并设置客户端授权密码 |
| Gmail | smtp.gmail.com | 587 | 需启用"不太安全的应用"或 App Password |
| 阿里企业邮箱 | smtp.qiye.aliyun.com | 465 | 企业邮箱管理员开启 |
| SendGrid | smtp.sendgrid.net | 587 | 使用 API Key 作为密码 |

### 方式二：无 SMTP（开发模式）

如果不配置 SMTP 环境变量，系统自动进入开发模式：
- 密码重置链接会输出到服务端控制台日志
- API 响应中会包含 `devResetUrl`（仅开发环境）
- 可直接使用该链接测试重置流程

---

## 三、环境变量汇总

将以下内容添加到 `.env.local` 文件中（按需填写）：

```env
# ===== GitHub OAuth =====
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# ===== Google OAuth =====
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ===== 微信开放平台 =====
WECHAT_OPEN_APP_ID=
WECHAT_OPEN_APP_SECRET=

# ===== 邮件服务 (SMTP) =====
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=系统通知
```

---

## 四、OAuth 登录流程说明

```
用户点击 "微信/GitHub/Google" 按钮
    ↓
前端: window.location.href = /api/auth/oauth/{provider}?redirect=/
    ↓
后端: 检查环境变量是否已配置
    ├─ 未配置 → 返回 503 错误，提示需要配置
    └─ 已配置 → 生成 state (CSRF 防护)，302 重定向到 OAuth 提供方
    ↓
用户在 OAuth 提供方页面完成授权
    ↓
OAuth 提供方回调: /api/auth/oauth/{provider}/callback?code=xxx&state=xxx
    ↓
后端: 验证 state → 用 code 换取 access_token → 获取用户信息
    ↓
后端: 查找或创建用户 → 创建会话 → 设置 Cookie → 重定向到首页
```

---

## 五、忘记密码流程说明

```
用户在登录页点击 "忘记密码?"
    ↓
前端: 跳转到 /forgot-password 页面，输入邮箱
    ↓
后端 /api/auth/forgot-password: 生成 resetToken (30分钟有效)
    ├─ 配置了 SMTP → 发送重置邮件
    └─ 未配置 SMTP → 开发模式，控制台输出重置链接
    ↓
用户点击邮件中的重置链接
    ↓
前端: 跳转到 /reset-password?token=xxx 页面，输入新密码
    ↓
后端 /api/auth/reset-password: 验证 token → 更新密码 → 返回成功
    ↓
前端: 提示成功，引导去登录页
```

---

## 六、演示账号

当前系统内置两个演示账号（内存存储，生产环境应替换为数据库）：

| 账号 | 密码 | 类型 |
|------|------|------|
| demo@example.com | demo123 | 邮箱 |
| 13800138000 | demo123 | 手机号 |

---

## 七、生产环境注意事项

1. **数据存储**: 当前使用内存 Map 存储用户和会话数据，服务重启后丢失。生产环境需接入数据库（如 Supabase/PostgreSQL）。
2. **密码加密**: 当前密码为明文比对，生产环境应使用 bcrypt/scrypt 加密。
3. **会话管理**: 当前使用简单随机字符串作为 Session ID，生产环境建议使用 JWT 或 Redis 存储。
4. **CSRF 防护**: OAuth 已使用 state 参数防 CSRF，表单提交建议额外加 CSRF Token。
5. **速率限制**: 建议对登录、验证码、忘记密码等接口添加请求频率限制。
