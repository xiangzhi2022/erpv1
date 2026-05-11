# DATABASE.md

云 Supabase 数据库约束、表结构原则与数据访问层文档。

## 基本约束

1. **字段命名**: 全部使用 `snake_case`，与 API 中的字段名保持一致。
2. **主键**: UUID 类型，`DEFAULT gen_random_uuid()`；`categories`/`tasks`/`notifications` 使用 `VARCHAR(36)`。
3. **时间字段**: 统一 `TIMESTAMPTZ`，带 `DEFAULT NOW()`。`created_at` 必填（`NOT NULL`），`updated_at` 可选。
4. **外键**: 使用 `ON DELETE CASCADE`（子表）或 `ON DELETE SET NULL`（弱关联）。
5. **索引**: 所有外键、过滤字段（status/category 等）、排序字段（created_at）必须有索引。
6. **RLS**: 所有业务表启用 RLS，后端使用 `service_role_key` 绕过。
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

1. **Schema 是唯一真相源**: `src/db/schema.ts` 定义表结构，`scripts/init-database.js` 必须与其保持一致。
2. **只增不删**: 不删除已有字段，只补充缺失的字段和表。
3. **API 字段对齐**: API 中使用的 snake_case 字段必须在 schema 或初始化脚本中有对应定义。
4. **Relations 只补充真实关系**: 不虚构完整性关系，只添加代码中实际使用的关联。
5. **避免 as any**: Schema 类型推断应能覆盖所有业务需求，不需要 `as any` 逃逸。

## 数据访问层架构

```text
业务代码层
src/app/actions/*.ts  src/app/api/**/route.ts
        |
        v
src/db/client.ts              src/lib/db.ts
Supabase Client               REST API 直接操作
getSupabaseServiceClient()    execSql()
getSupabaseClient()           insertData() / selectData() / deleteData()
        |
        v
getSupabaseCredentials()
环境变量优先级: COZE_SUPABASE_* > SUPABASE_*
拒绝 localhost / 127.0.0.1 / ::1 / *.local
```

### 服务端管理操作（绕过 RLS）

```typescript
import { getSupabaseServiceClient } from '@/db/client';

const supabase = getSupabaseServiceClient();
const { data, error } = await supabase.from('users').select('*');
```

### 匿名/用户级操作

```typescript
import { getSupabaseClient } from '@/db/client';

const supabase = getSupabaseClient();
const supabaseWithToken = getSupabaseClient(userToken);
```

### REST API 直接操作（src/lib/db.ts）

```typescript
import { execSql, insertData, selectData, deleteData } from '@/lib/db';

const result = await execSql({ sql: 'SELECT * FROM users LIMIT 10' });
await insertData('users', { name: 'test', phone: '123' });
const rows = await selectData('users', { status: 'active' }, 'id,name');
await deleteData('users', { id: '123' });
```

## 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `COZE_SUPABASE_URL` | 是 | 云 Supabase 实例 URL（如 `https://xxx.supabase.co`） |
| `COZE_SUPABASE_ANON_KEY` | 是 | 匿名访问 Key |
| `COZE_SUPABASE_SERVICE_ROLE_KEY` | 是* | 服务端管理 Key（绕过 RLS） |

* 服务端管理操作必须设置，否则 `getSupabaseServiceClient()` 和 `src/lib/db.ts` 的函数会抛出明确错误。

### Legacy 兼容

如果 `COZE_SUPABASE_*` 未设置，系统会回退读取 `SUPABASE_*` 变量。建议全部迁移到 `COZE_*` 命名。

### 本地 URL 拒绝

以下 URL 会被明确拒绝，项目不支持本地 Supabase：

- `http://localhost:*`
- `http://127.0.0.1:*`
- `http://[::1]:*`
- `*.local`

## 初始化脚本

```bash
node scripts/init-database.js
```

脚本行为:
- 检测表是否存在，不存在才创建（幂等）
- 创建索引（IF NOT EXISTS）
- 创建 `updated_at` 自动更新触发器
- 使用 `supabase.rpc('exec', { sql })` 执行 DDL

## 环境检查工具

```bash
node scripts/supabase-env.js check
node scripts/supabase-env.js print
node scripts/supabase-env.js export
```

## RLS 策略

- RLS 已启用，后端使用 `service_role_key` 绕过
- 无需创建额外的 RLS policy
- 业务代码中所有写操作通过 `getSupabaseServiceClient()` 执行

## 注意事项

- 云 Supabase 不支持直接 DDL，需要通过 `exec` RPC 函数或 Dashboard 执行。
- `supabase.rpc('exec')` 函数需要 `SECURITY DEFINER` 权限创建。
- 所有金额字段使用 `DECIMAL(12, 2)` 或 `numeric`，避免浮点精度问题。
- `skill_tags` 等灵活字段使用 `JSONB` 类型。
