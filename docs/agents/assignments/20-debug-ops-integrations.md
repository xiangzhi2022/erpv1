# Task 20: 调试与集成辅助 API 治理

建议分支: `codex-debug-ops-integrations`

建议 worker: `backend-agent`

## 任务目标

治理辅助 API，包括 debug、test db 和 ppt-fetch，明确这些接口的运行边界，避免生产环境暴露敏感信息或危险能力。

## 允许修改文件

- `src/app/api/debug/**`
- `src/app/api/test/**`
- `src/app/api/ppt-fetch/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/api/auth/**`
- `src/app/api/settings/**`
- `src/app/orders/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 debug env、debug user、settings-test 是否暴露密钥或敏感数据。
- 检查 test db route 是否只用于安全的连通性检查。
- 检查 ppt-fetch 是否限制输入、错误处理和远程请求边界。
- 对开发/生产环境行为做明确保护。
- 不删除接口，除非任务说明原因并保持调用方不受影响。

## 验收标准

- 辅助 API 不泄露密钥。
- 生产环境危险 debug 能力有保护。
- 错误响应明确且不暴露内部细节。
- 不改业务模块。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
chore(api): harden debug and integration routes
```
