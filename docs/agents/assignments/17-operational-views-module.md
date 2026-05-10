# Task 17: 运营轻量视图稳定化

建议分支: `codex-operational-views`

建议 worker: `frontend-agent`

## 任务目标

稳定订单相关轻量运营视图，包括订单看板、财务视图和发货视图，使其与订单 API 的状态、字段和更新行为一致。

## 允许修改文件

- `src/app/board/**`
- `src/app/finance/**`
- `src/app/shipping/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/api/orders/**`
- `src/app/orders/**`
- `src/app/progress/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 `board`、`finance`、`shipping` 页面读取 `/api/orders` 的字段。
- 保持订单状态命名和显示一致。
- 发货视图若更新订单状态，必须使用现有 API 约定。
- 不新增业务 API，除非现有页面无法正常工作且任务内说明原因。

## 验收标准

- 三个轻量视图能稳定读取订单数据。
- 状态筛选、金额展示、发货更新逻辑与订单模块一致。
- 不改订单 API 和订单主页面。
- 页面无明显 hydration 风险。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(ops): stabilize operational views
```

