# DATABASE.md — Supabase 数据访问层文档

## 架构概览

```
┌──────────────────────────────────────────────────────┐
│                   业务代码层                          │
│  src/app/actions/*.ts  src/app/api/**/route.ts       │
└──────────────┬──────────────────────┬────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌───────────────────────────┐
│  src/db/client.ts    │  │  src/lib/db.ts            │
│  Supabase Client     │  │  REST API 直接操作         │
│  ──────────────────  │  │  ──────────────────       │
│  getSupabaseService  │  │  execSql()                │
│  Client()            │  │  insertData()             │
│  getSupabaseClient() │  │  deleteData()             │
│                      │  │  selectData()             │
└──────────┬───────────┘  └───────────┬───────────────┘
           │                          │
           │    统一凭证来源           │
           ▼                          ▼
┌──────────────────────────────────────────────────────┐
│           getSupabaseCredentials()                    │
│  ──────────────────────────────────────────────      │
│  环境变量优先级: COZE_SUPABASE_* > SUPABASE_*       │
│  拒绝 localhost / 127.0.0.1 / ::1 / *.local         │
└──────────────────────────────────────────────────────┘
```

## 客户端使用指南

### 服务端管理操作（绕过 RLS）

```typescript
import { getSupabaseServiceClient } from '@/db/client';

const supabase = getSupabaseServiceClient();
const { data, error } = await supabase.from('users').select('*');
// 缺少 COZE_SUPABASE_SERVICE_ROLE_KEY 时会抛出明确错误
```

### 匿名/用户级操作

```typescript
import { getSupabaseClient } from '@/db/client';

// 无 token：使用 service_role_key 兜底，否则降级 anon key
const supabase = getSupabaseClient();

// 有 token：使用 anon key + 用户 Authorization header
const supabaseWithToken = getSupabaseClient(userToken);
```

### REST API 直接操作（src/lib/db.ts）

```typescript
import { execSql, insertData, selectData, deleteData } from '@/lib/db';

// 执行 SQL
const result = await execSql({ sql: 'SELECT * FROM users LIMIT 10' });

// 插入
await insertData('users', { name: 'test', phone: '123' });

// 查询
const rows = await selectData('users', { status: 'active' }, 'id,name');

// 删除
await deleteData('users', { id: '123' });
```

## 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `COZE_SUPABASE_URL` | 是 | 云 Supabase 实例 URL（如 `https://xxx.supabase.co`） |
| `COZE_SUPABASE_ANON_KEY` | 是 | 匿名访问 Key |
| `COZE_SUPABASE_SERVICE_ROLE_KEY` | 是* | 服务端管理 Key（绕过 RLS） |

\* 服务端管理操作必须设置，否则 `getSupabaseServiceClient()` 和 `src/lib/db.ts` 的函数会抛出明确错误。

### Legacy 兼容

如果 `COZE_SUPABASE_*` 未设置，系统会回退读取 `SUPABASE_*` 变量。建议全部迁移到 `COZE_*` 命名。

### 本地 URL 拒绝

以下 URL 会被明确拒绝，项目不支持本地 Supabase：

- `http://localhost:*`
- `http://127.0.0.1:*`
- `http://[::1]:*`
- `*.local`

## 环境检查工具

```bash
# 检查环境变量是否齐全
node scripts/supabase-env.js check

# 打印当前配置（脱敏）
node scripts/supabase-env.js print

# 输出 export 语句
node scripts/supabase-env.js export
```

## RLS 策略

- RLS 已启用，后端使用 `service_role_key` 绕过
- 无需创建额外的 RLS policy
- 业务代码中所有写操作通过 `getSupabaseServiceClient()` 执行

## 数据库 Schema

Schema 定义在 `src/db/schema.ts`（Drizzle ORM），本文件不涉及修改。
