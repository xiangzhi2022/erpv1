# Agent 任务派发表

这些文件是当前项目的第一轮多 agent 开发任务单。每个 Coze/Codex/Claude 窗口只引用一个任务文件，并按其中的边界执行。

## 派发顺序

1. 先派发 `01-database-schema-alignment.md`。
2. 再派发 `02-db-client-cleanup.md`。
3. `03-orders-module.md`、`04-progress-workflow.md`、`05-workers-module.md`、`06-supplier-module.md` 可以在前两项完成后并行派发。
4. `07-test-coverage.md` 在业务任务基本完成后派发。
5. `08-review-and-github.md` 最后派发，负责集成检查和 PR 交付。

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

