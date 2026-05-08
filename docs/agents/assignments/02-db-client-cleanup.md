# Task 02: 数据访问层统一

建议分支: `codex/db-client-cleanup`

建议 worker: `backend-agent`

## 任务目标

统一 Supabase 客户端创建、环境变量加载和服务端数据库访问方式。项目运行时必须只使用云 Supabase，不支持 localhost 或本地 Supabase。

## 允许修改文件

- `src/db/client.ts`
- `src/lib/db.ts`
- `scripts/supabase-env.js`
- `.env.example`
- `DATABASE.md`

## 禁止修改文件

- `src/db/schema.ts`
- `src/db/relations.ts`
- `src/app/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 服务端管理权限统一使用 `getSupabaseServiceClient()`。
- 匿名客户端统一使用 `getSupabaseClient(token?)`。
- 环境变量优先使用 `COZE_SUPABASE_URL`、`COZE_SUPABASE_ANON_KEY`、`COZE_SUPABASE_SERVICE_ROLE_KEY`。
- 可兼容 legacy `SUPABASE_*`，但要映射到 `COZE_*`。
- 明确拒绝 localhost、127.0.0.1、::1、`.local` 的 Supabase URL。
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

