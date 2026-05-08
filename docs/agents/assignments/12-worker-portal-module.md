# Task 12: 工人端工作台模块稳定化

建议分支: `codex-worker-portal-module`

建议 worker: `backend-agent`

## 任务目标

稳定工人端工作台，包括任务列表、个人信息读取、生产上报和 `production_tasks` 状态更新。

## 允许修改文件

- `src/app/worker/**`
- `src/app/api/worker/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/workers/**`
- `src/app/progress/**`
- `src/app/orders/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 `/api/worker/tasks` 的任务查询和权限过滤。
- 检查 `/api/worker/report` 的完成数量、状态更新和订单联动。
- 检查工人端页面对任务状态和进度字段的展示。
- 明确工人端与管理端 `workers` 模块的边界。

## 验收标准

- 工人端任务列表和上报路径稳定。
- 完成数量不会产生非法状态。
- `production_tasks` 状态和订单状态更新逻辑可解释。
- 不改管理端工人档案模块。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(worker): stabilize worker portal flows
```

