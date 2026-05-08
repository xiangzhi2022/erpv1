# Multi-Agent 协作索引

这些文档用于 Coze 多窗口手动调度 Codex / Claude / 其他编码 agent。每个窗口只引用一个角色文档，再附上具体任务即可。

## 推荐使用方式

1. 主控窗口引用 `master-agent.md`，让它拆任务、定义分支、验收标准和集成顺序。
2. Worker 窗口按任务类型引用对应文档。
3. 每个 worker 只处理一个子任务，使用独立分支或独立 worktree。
4. Worker 完成后只提交交付报告，不主动合并主分支。
5. 主控窗口负责最终 review、测试、合并、提交 PR。

## 角色文档

| 文档 | 用途 |
| --- | --- |
| `master-agent.md` | 主控 agent：需求拆解、任务分发、集成计划、最终 review |
| `frontend-agent.md` | 前端 worker：页面、组件、交互、Tailwind/shadcn UI |
| `backend-agent.md` | 后端 worker：API Route、Server Action、业务逻辑 |
| `database-agent.md` | 数据库 worker：Drizzle schema、Supabase、迁移和种子数据 |
| `test-agent.md` | 测试 worker：Vitest、React Testing Library、回归验证 |
| `review-agent.md` | 审查 agent：代码 review、风险检查、安全和质量门禁 |
| `github-agent.md` | GitHub agent：分支、提交、PR 描述、CI 结果整理 |

## 通用硬规则

- 只使用 `pnpm`，禁止 `npm` 和 `yarn`。
- 不允许隐式 `any`，不要使用 `as any`。
- 不要多个 agent 同时修改同一个文件。
- 不要在 JSX 渲染逻辑中直接使用 `Date.now()`、`Math.random()`、`typeof window`。
- 最终合并前至少运行：

```bash
pnpm ts-check
pnpm test
pnpm lint
```

