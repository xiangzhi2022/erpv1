# Task 03: 订单模块稳定化

建议分支: `codex/orders-module-hardening`

建议 worker: `backend-agent`

## 任务目标

稳定订单管理模块的数据查询、创建、状态流转和订单项写入逻辑。重点保证前端 `src/app/orders/**` 和后端 `src/app/api/orders/**` 的字段、状态和响应结构一致。

## 允许修改文件

- `src/app/orders/**`
- `src/app/api/orders/**`
- `src/app/api/customers/**`
- `src/app/api/factories/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/db/relations.ts`
- `src/app/progress/**`
- `src/app/supplier/**`
- `src/app/workers/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查订单列表、分页、搜索、状态筛选。
- 检查订单创建时 `orders` 和 `order_items` 写入是否一致。
- 检查订单状态：`pending`、`returned`、`confirmed`、`pool`、`producing`、`shipped`、`completed`、`cancelled`。
- 明确 `created_by` 权限过滤逻辑。
- API 响应保持 `{ success, data, pagination, stats }` 风格。
- 不做 UI 大改，只修复和稳定功能。

## 验收标准

- 订单列表、创建、状态更新路径可解释且字段一致。
- 前端 schema 和 API payload 一致。
- 失败路径有明确错误信息。
- 无无关模块改动。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

