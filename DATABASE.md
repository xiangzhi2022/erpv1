# DATABASE.md

云 Supabase 数据库约束、表结构原则与数据访问层文档。

## 基本约束

1. **字段命名**: 全部使用 `snake_case`，与 API 中的字段名保持一致。
2. **主键**: UUID 类型，`DEFAULT gen_random_uuid()`；`categories`/`tasks`/`notifications` 使用 `VARCHAR(36)`。
3. **时间字段**: 统一 `TIMESTAMPTZ`，带 `DEFAULT NOW()`。`created_at` 必填（`NOT NULL`），`updated_at` 可选。
4. **外键**: 使用 `ON DELETE CASCADE`（子表）或 `ON DELETE SET NULL`（弱关联）。
5. **索引**: 所有外键、过滤字段（status/category 等）、排序字段（created_at）必须有索引。
6. **RLS**: 所有业务表启用 RLS，服务端默认使用请求用户 JWT，不得以 Secret Key 代替租户授权。
7. **禁止删除**: `health_check` 表为系统表，禁止删除。

## 数据库架构

### 系统表

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| health_check | 系统心跳检测 | SERIAL |

### 用户与租户

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| users | 用户表 | UUID |
| tenants | 租户表 | UUID |
| tenant_users | 租户-用户关联 | UUID |

**tenants.tenant_type** 枚举: `manufacturer`, `dealer`, `material_supplier`, `producer`

**users.role** 常见值: `user`, `factory_admin`, `factory_user`, `super_admin`, `saas_admin`, `dealer_admin`

### 订单与客户

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| customers | 客户表 | UUID |
| orders | 订单表 | UUID |
| order_items | 订单项表 | UUID |
| order_prefixes | 订单前缀配置 | UUID |

**orders.status** 枚举: `pending`, `returned`, `confirmed`, `pool`, `producing`, `in_production`, `shipped`, `completed`, `cancelled`

**关键外键**:
- `order_items.order_id` -> `orders.id` (CASCADE)
- `orders.tenant_id` -> `tenants.id` (SET NULL)
- `orders.target_factory_id` -> `tenants.id` (无 FK 约束，逻辑关联)
- `orders.dealer_id` -> `tenants.id` (无 FK 约束，逻辑关联)

### 生产与车间

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| workshops | 基础车间表 | UUID |
| factory_workshops | 工厂车间详情表 | UUID |
| production_tasks | 生产任务表 | UUID |

**说明**: `workshops` 和 `factory_workshops` 是两套车间数据。
- `workshops` 被 `workers`、`production_tasks`、`work_orders` 引用。
- `factory_workshops` 被工厂管理页面使用，包含 `capacity`/`current_load`/`factory_code`/`manager`/`location` 等额外字段。

**production_tasks.progress** 枚举: `pending`, `processing`, `completed`

### 生产进度跟踪

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| work_orders | 工单表 | UUID |
| progress_logs | 进度日志表 | UUID |

**work_orders.status** 枚举: `pending`, `scheduling`, `producing`, `inspecting`, `stored`, `aborted`

**work_orders.priority** 枚举: `urgent`, `high`, `normal`, `low`

**progress_logs.action** 枚举: `start`, `complete_cutting`, `complete_assembly`, `complete_painting`, `quality_check`, `warehouse_in`, `report_progress`, `report_defect`, `pause`, `resume`, `abort`

### 工人管理

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| workers | 工人表 | UUID |

**workers.status** 枚举: `active`, `on_leave`, `resigned`

**workers.workshop_id** -> `workshops.id` (逻辑关联，无 FK 约束)

### 供应商管理

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| suppliers | 供应商表 | UUID |

**suppliers.rating** 常见值: `A`, `B`, `C`, `D`

### 经销商管理

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| dealers | 经销商表 | UUID |

### 任务管理 & 通知

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| categories | 分类表 | VARCHAR(36) |
| tasks | 任务表 | VARCHAR(36) |
| notifications | 通知表 | VARCHAR(36) |
| user_settings | 用户设置表 | UUID |

**tasks.category_id** -> `categories.id` (CASCADE)

## Schema 对齐原则

1. **迁移是唯一部署真相源**: `supabase/migrations/` 按时间顺序定义线上表结构；禁止使用仓库外 SQL 或旧初始化脚本绕过迁移历史。
2. **类型必须可重现**: `src/db/database.types.ts` 必须能从本地迁移数据库重新生成并通过 `pnpm db:types:check`。
3. **API 字段对齐**: API 中使用的 snake_case 字段必须在迁移、生成类型和需要保留的 Drizzle schema 中一致。
4. **Relations 只补充真实关系**: 不虚构完整性关系，只添加代码中实际使用的关联。
5. **避免 as any**: Schema 类型推断应能覆盖所有业务需求，不需要 `as any` 逃逸。

## 数据访问层架构

```text
业务代码层
src/app/actions/*.ts  src/app/api/**/route.ts
        |
        v
src/lib/supabase/server.ts    src/db/client.ts
请求级 SSR 用户客户端          受审计的窄范围服务端客户端
用户 JWT + RLS                仅允许显式批准的内部边界
        |
        v
getSupabaseCredentials()
环境变量: NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY；仅受审计边界使用 SUPABASE_SECRET_KEY
本地 Supabase 只用于 migrations、pgTAP、lint 和类型生成，不作为生产配置
```

### 用户级操作

```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
```

服务端 API 默认使用请求用户的 JWT 和数据库 RLS。Secret Key 客户端仅允许出现在安全测试明确批准的内部边界，
不得提供任意 SQL、任意表名或通用增删改查接口。

## 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | 云 Supabase 实例 URL（如 `https://xxx.supabase.co`） |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 是 | 浏览器和用户级请求使用的 Publishable Key |
| `SUPABASE_SECRET_KEY` | 是* | 仅服务端使用的 Secret Key（绕过 RLS） |

* 只有显式使用受审计 Secret Key 边界的服务端操作需要设置。

旧环境变量别名不再兼容，请按 `.env.example` 配置官方变量名。`SUPABASE_SECRET_KEY` 严禁暴露到浏览器或提交到仓库。

## 本地数据库与迁移

```bash
pnpm db:start
pnpm db:reset
pnpm db:test
pnpm db:lint
pnpm db:types:check
```

所有 schema、函数、权限和 RLS 变化都必须新增迁移并先在本地数据库通过 pgTAP 与 lint。
不得用 Secret Key 对远程项目执行任意 SQL，也不得从工具输出或 shell export 明文密钥。

## RLS 策略

- 业务表必须启用 RLS，并以请求用户 JWT 校验企业成员身份和权限。
- Secret Key 不替代租户授权；只有狭窄、受测试保护的基础设施操作可以绕过 RLS。
- 函数权限默认撤销，仅向确需的角色授予 `EXECUTE`。

## 注意事项

- 生产迁移只能通过已审查的 `supabase/migrations/` 和受控发布流程应用。
- 禁止创建通用 `exec(sql)` RPC 或从应用代码执行任意 DDL。
- 所有金额字段使用 `DECIMAL(12, 2)` 或 `numeric`，避免浮点精度问题。
- `skill_tags` 等灵活字段使用 `JSONB` 类型。
