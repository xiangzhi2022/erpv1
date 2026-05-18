# Remote Supabase Test Accounts

Updated: 2026-05-18

Login URL: `/login`

Login method: phone + password

Shared password for all accounts below: `Test@123456`

Seed script: `node scripts/seed-remote-test-organizations.js`

## Summary

| Type | Companies | Accounts | Notes |
| --- | ---: | ---: | --- |
| Factory | 3 | 39 | Full departments, positions, roles, employees, workers, workshops |
| Dealer | 3 | 9 | Admin, order entry, tracking/accounting |
| Supplier | 3 | 9 | Admin, receive order, send order |

## Factory Companies

### 测试工厂一厂有限公司

Tenant prefix: `F001`

| Phone | Name | Account role | Department | Position | Main permissions |
| --- | --- | --- | --- | --- | --- |
| 13911001001 | 测试工厂一厂 ERP 管理员 | factory_admin | 管理层 | 系统管理员 | factory_boss, factory_profit_view |
| 13911001002 | 测试工厂一厂 老板 | employee | 管理层 | 老板 | factory_boss, factory_profit_view |
| 13911001003 | 测试工厂一厂 生产主管 | employee | 生产部 | 生产主管 | factory_production_manager |
| 13911001004 | 测试工厂一厂 行政录入 | employee | 行政部 | 录入员 | factory_data_entry, factory_admin_staff, factory_order_manager |
| 13911001005 | 测试工厂一厂 财务 | employee | 财务部 | 财务 | factory_finance, factory_profit_view |
| 13911001006 | 测试工厂一厂 业务员 | employee | 业务部 | 业务员 | factory_sales, factory_order_manager |
| 13911001007 | 测试工厂一厂 仓库发货 | employee | 仓储部 | 仓库管理员 | factory_shipping |
| 13911001008 | 测试工厂一厂 质检员 | employee | 质检部 | 质检员 | factory_quality |
| 13911001009 | 测试工厂一厂 开料工 | employee | 生产部 | 开料工 | factory_worker, factory_general_worker, factory_carpenter |
| 13911001010 | 测试工厂一厂 封边工 | employee | 生产部 | 封边工 | factory_worker, factory_general_worker |
| 13911001011 | 测试工厂一厂 打孔工 | employee | 生产部 | 打孔工 | factory_worker, factory_general_worker |
| 13911001012 | 测试工厂一厂 组装工 | employee | 生产部 | 组装工 | factory_worker, factory_general_worker |
| 13911001013 | 测试工厂一厂 包装工 | employee | 生产部 | 包装工 | factory_worker, factory_packer |

### 测试工厂二厂有限公司

Tenant prefix: `F002`

| Phone | Name | Account role | Department | Position | Main permissions |
| --- | --- | --- | --- | --- | --- |
| 13911002001 | 测试工厂二厂 ERP 管理员 | factory_admin | 管理层 | 系统管理员 | factory_boss, factory_profit_view |
| 13911002002 | 测试工厂二厂 老板 | employee | 管理层 | 老板 | factory_boss, factory_profit_view |
| 13911002003 | 测试工厂二厂 生产主管 | employee | 生产部 | 生产主管 | factory_production_manager |
| 13911002004 | 测试工厂二厂 行政录入 | employee | 行政部 | 录入员 | factory_data_entry, factory_admin_staff, factory_order_manager |
| 13911002005 | 测试工厂二厂 财务 | employee | 财务部 | 财务 | factory_finance, factory_profit_view |
| 13911002006 | 测试工厂二厂 业务员 | employee | 业务部 | 业务员 | factory_sales, factory_order_manager |
| 13911002007 | 测试工厂二厂 仓库发货 | employee | 仓储部 | 仓库管理员 | factory_shipping |
| 13911002008 | 测试工厂二厂 质检员 | employee | 质检部 | 质检员 | factory_quality |
| 13911002009 | 测试工厂二厂 开料工 | employee | 生产部 | 开料工 | factory_worker, factory_general_worker, factory_carpenter |
| 13911002010 | 测试工厂二厂 封边工 | employee | 生产部 | 封边工 | factory_worker, factory_general_worker |
| 13911002011 | 测试工厂二厂 打孔工 | employee | 生产部 | 打孔工 | factory_worker, factory_general_worker |
| 13911002012 | 测试工厂二厂 组装工 | employee | 生产部 | 组装工 | factory_worker, factory_general_worker |
| 13911002013 | 测试工厂二厂 包装工 | employee | 生产部 | 包装工 | factory_worker, factory_packer |

### 测试工厂三厂有限公司

Tenant prefix: `F003`

| Phone | Name | Account role | Department | Position | Main permissions |
| --- | --- | --- | --- | --- | --- |
| 13911003001 | 测试工厂三厂 ERP 管理员 | factory_admin | 管理层 | 系统管理员 | factory_boss, factory_profit_view |
| 13911003002 | 测试工厂三厂 老板 | employee | 管理层 | 老板 | factory_boss, factory_profit_view |
| 13911003003 | 测试工厂三厂 生产主管 | employee | 生产部 | 生产主管 | factory_production_manager |
| 13911003004 | 测试工厂三厂 行政录入 | employee | 行政部 | 录入员 | factory_data_entry, factory_admin_staff, factory_order_manager |
| 13911003005 | 测试工厂三厂 财务 | employee | 财务部 | 财务 | factory_finance, factory_profit_view |
| 13911003006 | 测试工厂三厂 业务员 | employee | 业务部 | 业务员 | factory_sales, factory_order_manager |
| 13911003007 | 测试工厂三厂 仓库发货 | employee | 仓储部 | 仓库管理员 | factory_shipping |
| 13911003008 | 测试工厂三厂 质检员 | employee | 质检部 | 质检员 | factory_quality |
| 13911003009 | 测试工厂三厂 开料工 | employee | 生产部 | 开料工 | factory_worker, factory_general_worker, factory_carpenter |
| 13911003010 | 测试工厂三厂 封边工 | employee | 生产部 | 封边工 | factory_worker, factory_general_worker |
| 13911003011 | 测试工厂三厂 打孔工 | employee | 生产部 | 打孔工 | factory_worker, factory_general_worker |
| 13911003012 | 测试工厂三厂 组装工 | employee | 生产部 | 组装工 | factory_worker, factory_general_worker |
| 13911003013 | 测试工厂三厂 包装工 | employee | 生产部 | 包装工 | factory_worker, factory_packer |

## Dealer Companies

### 测试经销商华东有限公司

Tenant prefix: `D001`

| Phone | Name | Account role | Department | Position | Main permissions |
| --- | --- | --- | --- | --- | --- |
| 13912001001 | 测试经销商华东 ERP 管理员 | dealer_admin | 管理层 | 经销商管理员 | dealer_order_entry, dealer_accounting, dealer_order_submitter, dealer_order_tracker |
| 13912001002 | 测试经销商华东 订单录入 | employee | 业务部 | 订单录入员 | dealer_order_entry, dealer_order_submitter |
| 13912001003 | 测试经销商华东 跟单核算 | employee | 财务部 | 订单核算员 | dealer_order_tracker, dealer_accounting |

### 测试经销商华南有限公司

Tenant prefix: `D002`

| Phone | Name | Account role | Department | Position | Main permissions |
| --- | --- | --- | --- | --- | --- |
| 13912002001 | 测试经销商华南 ERP 管理员 | dealer_admin | 管理层 | 经销商管理员 | dealer_order_entry, dealer_accounting, dealer_order_submitter, dealer_order_tracker |
| 13912002002 | 测试经销商华南 订单录入 | employee | 业务部 | 订单录入员 | dealer_order_entry, dealer_order_submitter |
| 13912002003 | 测试经销商华南 跟单核算 | employee | 财务部 | 订单核算员 | dealer_order_tracker, dealer_accounting |

### 测试经销商华北有限公司

Tenant prefix: `D003`

| Phone | Name | Account role | Department | Position | Main permissions |
| --- | --- | --- | --- | --- | --- |
| 13912003001 | 测试经销商华北 ERP 管理员 | dealer_admin | 管理层 | 经销商管理员 | dealer_order_entry, dealer_accounting, dealer_order_submitter, dealer_order_tracker |
| 13912003002 | 测试经销商华北 订单录入 | employee | 业务部 | 订单录入员 | dealer_order_entry, dealer_order_submitter |
| 13912003003 | 测试经销商华北 跟单核算 | employee | 财务部 | 订单核算员 | dealer_order_tracker, dealer_accounting |

## Supplier Companies

### 测试供应商板材有限公司

Tenant prefix: `S001`

| Phone | Name | Account role | Department | Position | Main permissions |
| --- | --- | --- | --- | --- | --- |
| 13913001001 | 测试供应商板材 ERP 管理员 | supplier_admin | 管理层 | 供应商管理员 | supplier_order_receive, supplier_order_send |
| 13913001002 | 测试供应商板材 接单员 | employee | 业务部 | 接单员 | supplier_order_receive |
| 13913001003 | 测试供应商板材 发单员 | employee | 业务部 | 发单员 | supplier_order_send |

### 测试供应商五金有限公司

Tenant prefix: `S002`

| Phone | Name | Account role | Department | Position | Main permissions |
| --- | --- | --- | --- | --- | --- |
| 13913002001 | 测试供应商五金 ERP 管理员 | supplier_admin | 管理层 | 供应商管理员 | supplier_order_receive, supplier_order_send |
| 13913002002 | 测试供应商五金 接单员 | employee | 业务部 | 接单员 | supplier_order_receive |
| 13913002003 | 测试供应商五金 发单员 | employee | 业务部 | 发单员 | supplier_order_send |

### 测试供应商台面有限公司

Tenant prefix: `S003`

| Phone | Name | Account role | Department | Position | Main permissions |
| --- | --- | --- | --- | --- | --- |
| 13913003001 | 测试供应商台面 ERP 管理员 | supplier_admin | 管理层 | 供应商管理员 | supplier_order_receive, supplier_order_send |
| 13913003002 | 测试供应商台面 接单员 | employee | 业务部 | 接单员 | supplier_order_receive |
| 13913003003 | 测试供应商台面 发单员 | employee | 业务部 | 发单员 | supplier_order_send |

## Factory Organization Coverage

Each factory has these departments:

| Code | Department |
| --- | --- |
| management | 管理层 |
| production | 生产部 |
| finance | 财务部 |
| business | 业务部 |
| warehouse | 仓储部 |
| administration | 行政部 |
| quality | 质检部 |
| delivery | 发货部 |

Each factory also has these production/workshop-facing records:

| Area | Records |
| --- | --- |
| Workshops | 下料车间, 封边打孔车间, 组装质检车间, 包装发货车间 |
| Production workers | 开料工, 封边工, 打孔工, 组装工, 包装工 |
| Task assignable non-wage role | 质检员 |
| Wage enabled worker roles | 开料工, 封边工, 打孔工, 组装工, 包装工 |
