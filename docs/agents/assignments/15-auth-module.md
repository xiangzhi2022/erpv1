# Task 15: 认证模块稳定化

建议分支: `codex-auth-module`

建议 worker: `backend-agent`

## 任务目标

稳定认证模块，包括登录、注册、验证码、短信/邮件验证、OAuth、登出、忘记密码、重置密码和 session cookie 行为。

## 允许修改文件

- `src/app/login/**`
- `src/app/register/**`
- `src/app/forgot-password/**`
- `src/app/reset-password/**`
- `src/app/api/auth/**`
- `src/lib/auth.ts`
- `src/lib/auth-utils.ts`
- `src/lib/oauth.ts`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/settings/**`
- `src/app/orders/**`
- `src/app/progress/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查验证码、短信、邮件验证和 OAuth route 的失败路径。
- 检查 `auth_session`、`erp_user` 等 cookie 使用是否一致。
- 检查注册、登录、登出、重置密码的响应结构。
- 避免把密钥、短信配置或 OAuth secret 写入代码。
- 不引入持久化会话迁移，除非任务中已有实现基础。

## 验收标准

- 认证入口和 API 行为稳定。
- session cookie 读写边界清晰。
- 开发环境跳过验证码的逻辑可解释。
- 不改设置、订单、生产模块。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(auth): stabilize authentication flows
```

