# Task 13: 任务、分类与通知模块稳定化

建议分支: `codex-tasks-categories-notifications`

建议 worker: `backend-agent`

## 任务目标

稳定任务协作模块，包括任务 CRUD、分类管理、通知读取/标记、过期提醒和看板拖拽状态更新。

## 允许修改文件

- `src/app/tasks/**`
- `src/app/api/tasks/**`
- `src/app/api/categories/**`
- `src/app/api/notifications/**`
- `src/app/(dashboard)/categories/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/orders/**`
- `src/app/progress/**`
- `src/app/settings/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查任务创建、编辑、删除、完成切换和拖拽状态更新。
- 检查分类 CRUD 和任务关联。
- 检查通知列表、未读数量、全部已读和过期提醒。
- 保持 `tasks`、`categories`、`notifications` 响应结构一致。
- 避免在页面中引入 hydration 风险。

## 验收标准

- 任务看板和列表视图行为稳定。
- 分类管理和任务选择分类一致。
- 通知状态更新可重复执行。
- 不改业务 ERP 模块。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(tasks): stabilize tasks categories notifications
```

