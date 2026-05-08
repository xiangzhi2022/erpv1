# Task 14: 设置中心模块稳定化

建议分支: `codex-settings-module`

建议 worker: `backend-agent`

## 任务目标

稳定设置中心，包括个人资料、公司信息、用户管理、角色、安全设置、偏好设置、头像上传和订单前缀校验。

## 允许修改文件

- `src/app/settings/**`
- `src/app/api/settings/**`

## 禁止修改文件

- `src/db/schema.ts`
- `src/app/api/auth/**`
- `src/app/orders/**`
- `src/app/tasks/**`
- `package.json`
- `pnpm-lock.yaml`

## 具体要求

- 检查 profile、company、appearance、notifications、security、system 表单与 API 映射。
- 检查 users、roles、tenants、preferences、password、avatar API。
- 检查 `order_prefixes` 校验和保存逻辑。
- 统一 `user_settings` 的 key/value 字段使用。
- 明确权限校验和错误响应。

## 验收标准

- 设置页各子页面保存/读取路径稳定。
- 用户、租户、角色接口行为可解释。
- 头像上传不泄露密钥，不硬编码存储配置。
- 不改认证核心流程。

## 测试命令

```bash
pnpm ts-check
pnpm test
```

## 提交格式

```text
fix(settings): stabilize settings module
```

