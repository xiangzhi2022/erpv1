# Task 02: 数据访问层统一（历史任务，当前以 SSR 用户客户端和 RLS 为准）

建议分支: `codex/db-client-cleanup`

建议 worker: `backend-agent`

## 任务目标

此文件仅保留历史背景，不得作为当前实现指令。当前运行时使用官方 Supabase 变量、SSR 用户客户端与 RLS；
本地 Supabase 用于迁移、pgTAP、lint 和类型生成。

## 允许修改文件

- `src/db/client.ts`
- `src/lib/db.ts`
- `src/lib/supabase/**`
- `.env.example`
- `DATABASE.md`

## 禁止修改文件

- `src/db/schema.ts`
- `src/db/relations.ts`
- `src/app/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 请求处理默认使用 `src/lib/supabase/server.ts` 的用户客户端与 JWT。
- 环境变量只使用 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 和服务端专用 `SUPABASE_SECRET_KEY`。
- Secret Key 仅限受审计的窄范围内部操作，不得提供任意 SQL 或通用数据工具。
- 本地 URL 只能用于本地数据库验证，生产/预览部署由环境 guard 校验。
- 不要硬编码 URL 或 key。

## 验收标准

- 数据库客户端入口清晰。
- 脚本和运行时代码环境变量规则一致。
- 缺少 service role key 时服务端管理操作报明确错误。
- 不改业务 API 行为。

## 测试命令

```bash
pnpm ts-check
pnpm test
```
