# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL) + Drizzle (Schema 定义)
- **Testing**: Vitest + @testing-library/react

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本、数据迁移、种子数据
├── src/
│   ├── __tests__/          # 测试文件
│   │   ├── setup.ts        # 测试环境配置
│   │   ├── utils.test.ts   # 工具函数测试
│   │   ├── progress-schemas.test.ts  # 进度模块 Schema 测试
│   │   └── progress-logic.test.ts    # 进度模块业务逻辑测试
│   ├── app/
│   │   ├── (dashboard)/    # 带侧边栏的页面布局
│   │   │   ├── layout.tsx  # Dashboard 布局
│   │   │   ├── page.tsx    # 仪表盘首页
│   │   │   └── categories/ # 分类管理页面
│   │   ├── tasks/          # 任务管理页面
│   │   ├── progress/       # 生产进度跟踪页面
│   │   │   ├── page.tsx           # 进度主页面
│   │   │   ├── schemas.ts         # Zod Schema 定义
│   │   │   └── components/        # 进度模块组件
│   │   │       ├── progress-board.tsx     # 看板视图
│   │   │       ├── progress-toolbar.tsx   # 筛选工具栏
│   │   │       ├── progress-update.tsx    # 进度上报抽屉
│   │   │       ├── progress-detail.tsx    # 工单详情
│   │   │       ├── timeline-history.tsx   # 流转时间轴
│   │   │       └── stats-widgets.tsx      # 统计微件
│   │   ├── actions/        # Server Actions
│   │   └── api/            # API 路由层
│   │       ├── auth/       # 认证（登录/登出/验证码）
│   │       ├── categories/ # 分类 CRUD
│   │       ├── tasks/      # 任务 CRUD
│   │       ├── notifications/ # 通知
│   │       └── progress/   # 进度模块 API
│   │           ├── work-orders/  # 工单查询/创建
│   │           ├── report/       # 进度上报
│   │           ├── logs/         # 进度日志
│   │           └── workshops/    # 车间列表
│   ├── components/
│   │   ├── sidebar.tsx     # 侧边导航栏
│   │   └── ui/             # Shadcn UI 组件库
│   ├── db/                 # 数据库模块（从 storage/database 迁移而来）
│   │   ├── schema.ts       # Drizzle Schema 定义（所有表）
│   │   ├── relations.ts    # Drizzle 关系定义
│   │   └── client.ts       # Supabase 客户端初始化
│   ├── hooks/
│   ├── lib/
│   │   ├── auth.ts         # 认证模块
│   │   ├── auth-utils.ts   # 认证工具
│   │   └── utils.ts        # 通用工具函数
│   └── server.ts           # 自定义服务端入口
├── package.json
├── vitest.config.ts        # 测试配置
└── tsconfig.json
```

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

### 常用命令

- `pnpm dev` - 启动开发服务
- `pnpm build` - 构建生产版本
- `pnpm start` - 启动生产服务
- `pnpm test` - 运行测试（vitest）
- `pnpm ts-check` - TypeScript 类型检查
- `pnpm lint` - ESLint 检查
- `pnpm db:migrate` - 执行数据库迁移
- `pnpm seed` - 执行种子数据填充

## 编码规范

- 默认按 TypeScript `strict` 心智写代码
- 禁止隐式 `any` 和 `as any`
- 函数参数、返回值、解构项、事件对象应有明确类型
- 清理未使用的变量和导入

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random()
2. 必须使用 'use client' 并配合 useEffect + useState
3. 禁止非法 HTML 嵌套（如 `<p>` 嵌套 `<div>`）
4. 三方 CSS、字体等资源可在 `globals.css` 中通过 `@import` 引入或使用 next/font

## 数据库配置

**数据库**: Supabase (环境变量 `COZE_SUPABASE_URL`)
**Schema 定义**: `src/db/schema.ts` (Drizzle ORM)
**关系定义**: `src/db/relations.ts`
**客户端**: `src/db/client.ts` (导出 `getSupabaseClient`, `getSupabaseServiceClient`)

### 数据库表

| 表名 | 说明 |
|------|------|
| users | 系统用户表 |
| tenants | 租户表 |
| tenant_users | 租户用户表 |
| orders | 订单表 |
| order_items | 订单项表 |
| customers | 客户表 |
| workshops | 车间表 |
| work_orders | 生产工单表 |
| progress_logs | 进度日志表 |
| production_tasks | 生产任务表 |
| order_prefixes | 订单前缀表 |
| user_settings | 用户设置表 |
| categories | 分类表 |
| tasks | 任务表 |
| profiles | 用户档案 |
| notifications | 通知表 |
| sms_codes | 短信验证码 |
| operation_logs | 操作日志 |
| shipping | 发货信息 |

### 生产进度模块核心表结构

**work_orders (生产工单)**:
- id, order_id, order_item_id, workshop_id
- product_name, target_quantity, completed_quantity
- status (pending/producing/inspecting/stored/aborted)
- priority (low/normal/high/urgent)
- start_date, expected_end_date, actual_end_date
- remark, created_by, created_at, updated_at

**progress_logs (进度日志)**:
- id, work_order_id
- action (start/report_progress/quality_check/warehouse_in/abort/...)
- operator_name, completed_delta
- remark, created_at

## API 端点

### 认证
- `POST /api/auth/login` - 登录（需验证码，开发环境设置 SKIP_CAPTCHA=1 跳过）
- `POST /api/auth/logout` - 登出
- `GET /api/auth/captcha` - 获取验证码

### 生产进度
- `GET /api/progress/work-orders` - 工单列表（支持 status/workshop_id/priority/keyword 筛选）
- `POST /api/progress/work-orders` - 创建工单
- `POST /api/progress/report` - 提交进度上报（自动状态流转）
- `GET /api/progress/logs` - 获取进度日志（按 work_order_id）
- `GET /api/progress/workshops` - 车间列表

### 认证方式
- Cookie-based session (`auth_session`)
- `getUserFromRequest(request)` 从 cookie 中解析当前用户
- 内存会话存储（服务器重启后失效）

### 环境变量

| 变量 | 说明 |
|------|------|
| COZE_SUPABASE_URL | Supabase URL |
| COZE_SUPABASE_ANON_KEY | Anon Key |
| COZE_SUPABASE_SERVICE_ROLE_KEY | Service Role Key |
| SKIP_CAPTCHA | 跳过验证码校验（开发用） |
| PORT | 服务端口（默认 5000） |
| COZE_PROJECT_DOMAIN_DEFAULT | 对外访问域名 |

### 数据库工具

```bash
node scripts/db-tool.js list                          # 列出所有表
node scripts/db-tool.js select <table>                # 查询表数据
node scripts/db-tool.js query "SELECT * FROM ..."     # 执行SQL查询
node scripts/seed-sandbox.js                          # 填充种子数据
```

## 测试体系

- **框架**: Vitest + @testing-library/react
- **配置**: vitest.config.ts
- **设置**: src/__tests__/setup.ts
- **运行**: `pnpm test` 或 `pnpm test:watch`
- **覆盖范围**: Schema 验证、业务逻辑、工具函数
