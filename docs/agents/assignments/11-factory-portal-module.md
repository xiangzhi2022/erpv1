# Task 11: 工厂端门户模块稳定化

建议分支: `codex-factory-portal-module`

建议 worker: `backend-agent`

## 任务目标

稳定工厂端门户，包括工厂订单池、生产任务统计、工厂视角订单读取和任务数据一致性。

## 允许修改文件

- `src/app/factory/page.tsx`
- `src/app/api/factory/orders/**`
- `src/app/api/factories/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/factory/workshops/**`
- `src/app/orders/**`
- `src/app/progress/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 `/api/factory/orders` 的订单读取、筛选和任务统计。
- 检查 `/api/factories` 的工厂租户列表响应。
- 保持工厂端页面对订单、任务数量、进度字段的使用一致。
- 避免和车间管理任务修改同一文件。

## 验收标准

- 工厂端订单池数据可解释。
- 生产任务统计与 `production_tasks` 字段一致。
- 工厂租户 API 可被订单创建和工厂门户复用。
- 不改车间管理和订单主模块。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(factory): stabilize factory portal
```

