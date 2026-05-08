# Task 19: Dashboard Shell 与同步页稳定化

建议分支: `codex-dashboard-shell-sync`

建议 worker: `frontend-agent`

## 任务目标

稳定旧 dashboard 分组、分类入口和数据同步页面，确保根布局、侧边栏、分类管理和同步入口与当前项目导航一致。

## 允许修改文件

- `src/app/(dashboard)/**`
- `src/components/sidebar.tsx`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/api/**`
- `src/app/tasks/**`
- `src/app/settings/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 `(dashboard)` layout、首页、categories、sync 的导航和页面入口。
- 检查 `src/components/sidebar.tsx` 是否仍只服务旧 dashboard，避免破坏其他布局。
- 保持现有分类和同步页面行为，不重写业务逻辑。
- 不修改 API route。

## 验收标准

- 旧 dashboard 分组页面可访问且导航清晰。
- 分类管理入口和任务分类 API 使用一致。
- 数据同步页不会误导用户执行破坏性操作。
- 不改业务 API。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(shell): stabilize dashboard shell and sync pages
```

