# Task 06: 供应商模块完善

建议分支: `codex/supplier-module`

建议 worker: `backend-agent`

## 任务目标

稳定供应商档案模块，包括列表、创建、编辑、删除、状态变更、评级筛选和供应商订单接口。

## 允许修改文件

- `src/app/supplier/**`
- `src/app/api/supplier/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/orders/**`
- `src/app/progress/**`
- `src/app/workers/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 `/api/supplier/list` 的筛选和分页。
- 检查 `/api/supplier/create` 的编码生成和字段写入。
- 检查 `/api/supplier/update` 的字段映射和状态更新。
- 检查 `/api/supplier/delete` 的删除行为。
- 检查 `supplierFormSchema` 和 API payload 的 camelCase/snake_case 映射。
- 保持 `active`、`inspecting`、`blacklisted` 状态一致。

## 验收标准

- 供应商 CRUD 路径稳定。
- 表单字段、API payload、数据库字段映射清晰。
- 删除和状态变更有明确错误处理。
- 不改工人、订单、进度模块。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

