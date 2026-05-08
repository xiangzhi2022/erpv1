# Task 04: 生产进度模块闭环

建议分支: `codex/progress-workflow`

建议 worker: `backend-agent`

## 任务目标

统一生产进度模块的工单状态、进度上报、日志写入和测试逻辑。当前测试中存在旧状态名，运行时代码使用的是 `pending`、`producing`、`inspecting`、`stored`、`aborted`。

## 允许修改文件

- `src/app/progress/**`
- `src/app/api/progress/**`
- `src/__tests__/progress-schemas.test.ts`
- `src/__tests__/progress-logic.test.ts`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/orders/**`
- `src/app/supplier/**`
- `src/app/workers/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 统一状态命名，避免 `quality_check`、`warehoused` 与 `inspecting`、`stored` 混用。
- 检查 `progressReportSchema`、API route、测试中的 action 和 status 是否一致。
- 工单创建时写入初始日志。
- 进度上报时同时更新 `work_orders` 并写入 `progress_logs`。
- 完成数量不能超过目标数量。
- 入库时写入 `actual_end_date`。

## 验收标准

- 状态流转清晰且测试覆盖。
- 进度日志字段和前端时间轴字段一致。
- 看板统计字段和 API 返回一致。
- 不改订单、供应商、工人模块。

## 测试命令

```bash
pnpm test
pnpm ts-check
```

