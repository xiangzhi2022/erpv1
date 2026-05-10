# Task 18: 客户与工厂共享 API 稳定化

建议分支: `codex-shared-customers-factories-api`

建议 worker: `backend-agent`

## 任务目标

稳定共享基础 API，包括客户搜索/创建和工厂租户列表，为订单、经销商和工厂模块提供一致数据源。

## 允许修改文件

- `src/app/api/customers/**`
- `src/app/api/factories/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/orders/**`
- `src/app/factory/**`
- `src/app/dealer/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 `/api/customers` 的搜索、创建和去重逻辑。
- 检查 `/api/factories` 的工厂租户列表、字段映射和权限过滤。
- 保持响应结构可被订单创建弹窗复用。
- 不把模块专用逻辑塞入共享 API。

## 验收标准

- 客户 API 和工厂 API 字段稳定。
- 空数据和权限受限时返回可解释结果。
- 不引入页面改动。
- 不改订单主流程。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(api): stabilize customers and factories APIs
```

