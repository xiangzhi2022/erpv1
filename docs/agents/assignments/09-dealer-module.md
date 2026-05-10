# Task 09: 经销商模块稳定化

建议分支: `codex-dealer-module`

建议 worker: `backend-agent`

## 任务目标

稳定经销商管理模块，包括经销商列表、创建、编辑、删除、搜索筛选、经销商订单创建和权限过滤。

## 允许修改文件

- `src/app/dealer/**`
- `src/app/api/dealer/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/orders/**`
- `src/app/supplier/**`
- `src/app/workers/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查经销商表单字段和 API payload 映射。
- 检查 `/api/dealer` 的列表、创建、筛选和分页行为。
- 检查 `/api/dealer/[id]` 的更新和删除权限。
- 检查 `/api/dealer/orders` 和 `/api/dealer/orders/create` 的订单创建链路。
- 保持响应结构稳定，失败路径返回明确错误。

## 验收标准

- 经销商 CRUD 路径稳定。
- 经销商订单创建与订单/订单项字段一致。
- 非管理员权限过滤逻辑清晰。
- 不引入跨模块无关改动。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(dealer): stabilize dealer module
```

