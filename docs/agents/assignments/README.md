# Agent 任务派发表

这些文件是当前项目的多 agent 开发任务单。每个 Coze/Codex/Claude 窗口只引用一个任务文件，并按其中的边界执行。

## 派发顺序

1. 先派发 `01-database-schema-alignment.md`。
2. 再派发 `02-db-client-cleanup.md`。
3. `03-orders-module.md`、`04-progress-workflow.md`、`05-workers-module.md`、`06-supplier-module.md` 和 `09` 到 `18` 可按依赖分批并行派发。
4. `19-dashboard-shell-sync-module.md` 和 `20-debug-ops-integrations.md` 可独立派发。
5. `07-test-coverage.md` 在业务任务基本完成后派发。
6. `08-review-and-github.md` 最后派发，负责集成检查和 PR 交付。

## 任务索引

| 文件 | 建议分支 | Worker | 覆盖范围 |
| --- | --- | --- | --- |
| `01-database-schema-alignment.md` | `codex-db-schema-alignment` | `database-agent` | Drizzle schema、relations、初始化脚本 |
| `02-db-client-cleanup.md` | `codex-db-client-cleanup` | `backend-agent` | Supabase client、环境变量、数据库访问 |
| `03-orders-module.md` | `codex-orders-module-hardening` | `backend-agent` | 订单页面与订单 API |
| `04-progress-workflow.md` | `codex-progress-workflow` | `backend-agent` | 生产进度工单、上报、日志 |
| `05-workers-module.md` | `codex-workers-module` | `backend-agent` | 工人档案管理 |
| `06-supplier-module.md` | `codex-supplier-module` | `backend-agent` | 供应商档案与供应商订单 |
| `07-test-coverage.md` | `codex-test-coverage-core-flows` | `test-agent` | 核心流程测试补齐 |
| `08-review-and-github.md` | `codex-release-integration` | `review-agent + github-agent` | 最终 review、集成、PR |
| `09-dealer-module.md` | `codex-dealer-module` | `backend-agent` | 经销商页面与 API |
| `10-factory-workshops-module.md` | `codex-factory-workshops-module` | `backend-agent` | 工厂车间管理 |
| `11-factory-portal-module.md` | `codex-factory-portal-module` | `backend-agent` | 工厂端订单池与任务统计 |
| `12-worker-portal-module.md` | `codex-worker-portal-module` | `backend-agent` | 工人端任务与上报 |
| `13-tasks-categories-notifications-module.md` | `codex-tasks-categories-notifications` | `backend-agent` | 任务、分类、通知 |
| `14-settings-module.md` | `codex-settings-module` | `backend-agent` | 设置中心 |
| `15-auth-module.md` | `codex-auth-module` | `backend-agent` | 认证、验证码、OAuth、密码重置 |
| `16-dashboard-reporting-module.md` | `codex-dashboard-reporting` | `backend-agent` | 仪表盘与统计报表 |
| `17-operational-views-module.md` | `codex-operational-views` | `frontend-agent` | 看板、财务、发货轻量视图 |
| `18-customers-factories-shared-api.md` | `codex-shared-customers-factories-api` | `backend-agent` | 客户与工厂共享 API |
| `19-dashboard-shell-sync-module.md` | `codex-dashboard-shell-sync` | `frontend-agent` | 旧 dashboard 分组与同步页 |
| `20-debug-ops-integrations.md` | `codex-debug-ops-integrations` | `backend-agent` | debug/test/ppt-fetch 辅助 API |

## Worker 启动规则

- 每个 worker 先同步最新 `main`，再创建独立分支。
- 如果工作区不干净，停止并汇报，不要覆盖已有改动。
- 每个 worker 只提交任务范围内文件。
- 每个 worker 推送到自己的 `origin/<branch>`，不要合并 `main`。

## 当前基线

- `pnpm ts-check` 当前通过。
- `pnpm test` 当前通过，3 个测试文件，33 个测试。
- 当前工作区已有未提交改动。Worker 不要回滚、不覆盖、不格式化无关文件。

## 通用交付格式

每个 worker 完成后只返回：

```text
## 修改文件
- ...

## 实现说明
- ...

## 验证
- 已运行: ...
- 未运行及原因: ...

## 风险
- ...
```

## 硬规则

- 只能使用 `pnpm`。
- 不要使用 `npm` 或 `yarn`。
- 不要使用隐式 `any` 或 `as any`。
- 不要多个 worker 同时修改同一个文件。
- 不要提交 `.env` 或密钥。
- Worker 不做最终合并，最终集成由 review/github agent 处理。
