# Task 10: 工厂车间模块稳定化

建议分支: `codex-factory-workshops-module`

建议 worker: `backend-agent`

## 任务目标

稳定车间管理模块，包括车间列表、创建、编辑、删除、状态切换、产能统计和负荷率计算。

## 允许修改文件

- `src/app/factory/workshops/**`
- `src/app/api/factory/workshops/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/orders/**`
- `src/app/progress/**`
- `src/app/workers/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查车间前端类型和 API 返回字段一致性。
- 检查 `/api/factory/workshops` 的列表、筛选、创建和统计。
- 检查 `/api/factory/workshops/[id]` 的详情、更新、删除。
- 统一车间状态：`normal`、`maintenance`、`stopped`。
- 明确 `capacity`、`current_load`、`load_percentage` 的计算和边界。

## 验收标准

- 车间 CRUD 和状态切换稳定。
- 统计卡片数据与 API 返回一致。
- 删除和更新失败路径有明确处理。
- 不改工厂门户、订单、进度模块。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(factory): stabilize workshop management
```

