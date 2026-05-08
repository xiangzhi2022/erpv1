# Task 01: 数据库 Schema 对齐

建议分支: `codex/db-schema-alignment`

建议 worker: `database-agent`

## 任务目标

对齐 Drizzle schema、relations、数据库初始化脚本和当前 API 实际使用的表结构。当前代码已经使用 `workers`、`suppliers`、`created_by`、`operator_name`、`completed_delta` 等表/字段，但 `src/db/schema.ts` 没有完整覆盖，后续业务开发需要先稳定数据模型。

## 允许修改文件

- `src/db/schema.ts`
- `src/db/relations.ts`
- `scripts/init-database.js`
- `DATABASE.md`

## 禁止修改文件

- `src/app/**`
- `src/components/**`
- `src/lib/db.ts`
- `src/db/client.ts`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 补齐当前 API 已使用但 schema 缺失的核心表和字段。
- 重点检查 `orders`、`order_items`、`work_orders`、`progress_logs`、`workers`、`suppliers`、`tenants`、`users`。
- 不删除已有字段。
- 字段命名必须和 API 中实际使用的 snake_case 字段一致。
- `relations.ts` 只补充真实可用关系，不要为了完整性虚构关系。
- `scripts/init-database.js` 要和 schema 的核心字段保持一致。
- `DATABASE.md` 记录云 Supabase 约束和表结构原则。

## 验收标准

- `src/db/schema.ts` 覆盖当前业务模块核心表。
- API 中明显使用的字段能在 schema 或初始化脚本中找到对应定义。
- 没有引入业务页面改动。
- 不引入 `as any`。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

