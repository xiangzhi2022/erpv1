# Task 05: 工人模块完善

建议分支: `codex/workers-module`

建议 worker: `backend-agent`

## 任务目标

稳定工人档案模块，包括工人列表、创建、编辑、删除、统计、工种分布和车间关联。

## 允许修改文件

- `src/app/workers/**`
- `src/app/api/workers/**`
- `src/app/api/worker/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/orders/**`
- `src/app/progress/**`
- `src/app/supplier/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 `/api/workers` 的分页、搜索、工种筛选、状态筛选。
- 检查 `/api/workers/stats` 统计逻辑。
- 检查 `/api/workers/[id]` 的详情、更新、删除。
- 确认前端 `Worker` 类型和 API 返回字段一致。
- 表单提交字段保持 snake_case 和 schema 一致。

## 验收标准

- 工人 CRUD 路径稳定。
- 工种分布和状态统计可解释。
- 删除行为有明确失败处理。
- 不引入跨模块改动。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

