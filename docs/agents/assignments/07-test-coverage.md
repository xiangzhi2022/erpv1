# Task 07: 核心流程测试补齐

建议分支: `codex/test-coverage-core-flows`

建议 worker: `test-agent`

## 任务目标

补充当前 ERP 核心流程的单元测试和 schema 测试。测试应优先覆盖状态流转、输入校验和纯逻辑，不依赖真实 Supabase 网络。

## 允许修改文件

- `src/__tests__/**`
- 必要时可只读参考 `src/app/**/schemas.ts`

## 禁止修改文件

- `src/app/api/**`
- `src/app/**/components/**`
- `src/db/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 补充订单状态流转测试。
- 补充生产进度状态流转测试。
- 补充 worker schema/helper 测试。
- 补充 supplier schema/helper 测试。
- 修复已有测试里的旧状态名，使其和运行时代码一致。
- 不为了通过测试降低断言质量。

## 验收标准

- 测试可重复运行。
- 不依赖真实数据库。
- 覆盖核心状态和输入校验。
- 没有删除现有有效测试。

## 测试命令

```bash
pnpm test
pnpm ts-check
```

