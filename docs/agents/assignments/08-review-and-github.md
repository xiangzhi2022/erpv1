# Task 08: Review 与 GitHub 交付

建议分支: `codex/release-integration`

建议 worker: `review-agent` + `github-agent`

## 任务目标

在各 worker 任务完成后进行最终集成检查、代码 review、验证命令执行、提交信息整理和 PR 描述准备。

## 允许修改文件

- 文档文件
- PR 描述
- 小范围冲突修复文件

## 禁止修改文件

- 不做大规模业务重构。
- 不重写已经通过 review 的 worker 实现。
- 不提交 `.env` 或密钥。
- 不把无关工作区改动混入最终 PR。

## 具体要求

- 检查每个 worker 是否只修改了允许范围内的文件。
- 检查是否有多个 worker 修改同一文件导致冲突。
- 检查数据库 schema、API、前端 schema 是否一致。
- 检查认证、权限、租户隔离风险。
- 检查是否存在 `as any`、隐式 `any`、无关格式化。
- 运行最终验证命令。
- 准备 PR 描述。

## 验收标准

- 最终分支变更范围清晰。
- PR 描述包含 Summary、Changes、Validation、Risks。
- 所有未运行测试必须说明原因。
- 工作区无无关改动混入。

## 测试命令

```bash
pnpm ts-check
pnpm test
pnpm lint
```

