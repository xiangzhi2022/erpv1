# Task 16: 仪表盘与报表模块稳定化

建议分支: `codex-dashboard-reporting`

建议 worker: `backend-agent`

## 任务目标

稳定仪表盘统计和报表数据，包括 KPI、趋势图、订单状态图、近期动态和前端组件数据消费。

## 允许修改文件

- `src/app/dashboard/**`
- `src/app/api/dashboard/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/orders/**`
- `src/app/tasks/**`
- `src/app/settings/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 `/api/dashboard/kpis` 的订单、客户、租户、任务统计。
- 检查 `/api/dashboard/chart` 的时间序列和状态分布。
- 检查 `/api/dashboard/activity` 的近期动态来源。
- 保持 dashboard 组件对 API 字段的使用一致。
- 对缺表或空数据提供稳定 fallback。

## 验收标准

- 仪表盘空数据、错误数据和正常数据都能稳定渲染。
- 图表和 KPI 字段与 API 返回一致。
- 统计权限过滤逻辑可解释。
- 不改订单主流程。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(dashboard): stabilize reporting APIs
```

