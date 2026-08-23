import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('enterprise scope RPC boundary', () => {
  it('requires enterprise scope for order-level finance and workflow RPCs', () => {
    const finance = source('supabase/migrations/20260823103000_finance_wage_atomic_rpcs.sql');
    const orders = source('supabase/migrations/20260823145000_order_financial_write_boundary.sql');
    const production = source('supabase/migrations/20260823150000_production_progress_write_boundary.sql');

    expect(finance).toContain("has_enterprise_permission(target_enterprise_id, 'finance.manage')");
    for (const permission of ['wages.manage', 'wages.settle']) {
      expect(finance).toContain(`has_enterprise_permission(target_enterprise_id, '${permission}')`);
    }
    expect(orders).not.toMatch(/app_private\.has_permission\(target_enterprise_id, '(?:orders\.|finance\.|production\.|shipping\.)/);
    expect(production).toMatch(/confirm_order_task_drafts[\s\S]+?has_enterprise_permission\(target_enterprise_id, 'production\.plan'\)/);
    const componentTransition = production.match(
      /create or replace function public\.transition_order_component_status[\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';
    expect(componentTransition).toContain("target_type is null or target_type not in ('space', 'product')");
    expect(componentTransition).toContain('target_status is null or target_status not in (');
  });

  it('does not disclose wage-derived order summaries without enterprise wage read access', () => {
    const migration = source('supabase/migrations/20260823151000_sensitive_read_boundary.sql');
    const summary = migration.match(/create or replace function public\.finance_list_order_summaries[\s\S]+?end;\n\$\$;/i)?.[0] ?? '';

    expect(summary).toContain("has_enterprise_permission(target_enterprise_id, 'finance.read')");
    expect(summary).toMatch(/has_enterprise_permission\(\s*target_enterprise_id,\s*'wages\.read\.all'/);
    expect(summary).toContain('can_read_wages');
  });

  it('keeps batch order item pricing behind enterprise finance read access', () => {
    const migration = source('supabase/migrations/20260823151000_sensitive_read_boundary.sql');
    const itemAmounts = migration.match(
      /create function public\.finance_list_order_item_amounts[\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';
    expect(itemAmounts).toContain("has_enterprise_permission(target_enterprise_id, 'finance.read')");
    expect(itemAmounts).toContain('item_row.enterprise_id = target_enterprise_id');
    expect(itemAmounts).toContain('item_row.order_id = any(target_order_ids)');
  });

  it('uses enterprise-scope helpers and one batch summary RPC in application routes', () => {
    const detail = source('src/app/api/orders/[id]/route.ts');
    const dashboard = source('src/app/api/dashboard/summary/route.ts');
    const financeDashboard = source('src/app/api/dashboard/finance-summary/route.ts');
    const products = source('src/app/api/spaces/[id]/products/route.ts');

    expect(detail).toContain("hasEnterprisePermission(context, 'finance.read')");
    expect(detail).toContain("hasEnterprisePermission(context, 'finance.manage')");
    expect(detail).not.toMatch(/finance\.read'\) \|\| context\.grants\.has\('finance\.manage/);
    expect(products).toContain("hasEnterprisePermission(context, 'finance.manage')");
    for (const route of [dashboard, financeDashboard]) {
      expect(route).toContain("rpc('finance_list_order_summaries'");
      expect(route).not.toContain("rpc('finance_read_order_details'");
      expect(route).toContain("hasEnterprisePermission(context, 'finance.read')");
      expect(route).toContain("hasEnterprisePermission(context, 'wages.read.all')");
    }
  });

  it('does not let unrelated scoped wages.read.self grants use the self policy', () => {
    const migration = source('supabase/migrations/20260823151000_sensitive_read_boundary.sql');
    const policy = migration.match(/create policy worker_wage_records_select[\s\S]+?;\n/i)?.[0] ?? '';
    expect(policy).toContain('app_private.effective_grants(worker_wage_records.enterprise_id)');
    expect(policy).toMatch(/scope_kind\s+in\s+\('enterprise',\s*'self'\)/);
  });

  it('forward-fixes previously recorded enterprise-wide mutation functions and direct wage writes', () => {
    const migration = source('supabase/migrations/20260823154000_enterprise_scope_forward_fixes.sql');
    expect(migration).toMatch(/revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+public\.worker_wage_records\s+from\s+authenticated/i);
    expect(migration).toContain('drop policy if exists worker_wage_records_insert_pending');
    expect(migration).toContain('drop policy if exists worker_wage_records_update_pending');

    const permissionByFunction = new Map([
      ['finance_update_order_pricing', 'finance.manage'],
      ['finance_settle_wage_records', 'wages.settle'],
      ['finance_pay_wage_record', 'wages.settle'],
      ['finance_manage_wage_record', 'wages.manage'],
      ['create_order_exchange', 'orders.submit'],
    ]);
    for (const [functionName, permission] of permissionByFunction) {
      const functionSource = migration.match(new RegExp(
        `create or replace function public\\.${functionName}[\\s\\S]+?end;\\n\\$\\$;`,
        'i',
      ))?.[0] ?? '';
      expect(functionSource).toContain(`has_enterprise_permission(target_${
        functionName === 'create_order_exchange' ? 'from_' : ''
      }enterprise_id, '${permission}')`);
      expect(functionSource).not.toContain('app_private.has_permission(');
    }
    const transitionExchange = migration.match(
      /create or replace function public\.transition_order_exchange[\s\S]+?end;\n\$\$;/i,
    )?.[0] ?? '';
    expect(transitionExchange).toContain("has_enterprise_permission(existing_exchange.from_enterprise_id, 'orders.update')");
    expect(transitionExchange).toContain("has_enterprise_permission(existing_exchange.to_enterprise_id, 'orders.accept')");
    expect(transitionExchange).not.toContain('app_private.has_permission(');
  });

  it('rejects scoped all-wage grants at direct wage API boundaries', () => {
    for (const path of [
      'src/app/api/performance/orders/route.ts',
      'src/app/api/performance/workers/route.ts',
      'src/app/api/performance/workers/[id]/route.ts',
      'src/app/api/workers/[id]/wages/route.ts',
    ]) {
      expect(source(path)).toContain("hasEnterprisePermission(context, 'wages.read.all')");
    }
  });

  it('keeps employee base salary behind enterprise wage permission', () => {
    const migration = source('supabase/migrations/20260823151000_sensitive_read_boundary.sql');
    expect(migration).toMatch(/revoke\s+select\s+on\s+table\s+public\.employees\s+from\s+authenticated/i);
    const grant = migration.match(/grant\s+select\s*\(([^)]+)\)\s+on\s+table\s+public\.employees/i)?.[1] ?? '';
    expect(grant).not.toContain('base_salary');
    expect(migration).toContain('create function public.wages_read_employee_base_salaries(');
    expect(migration).toContain("has_enterprise_permission(target_enterprise_id, 'wages.read.all')");

    for (const path of [
      'src/app/api/employees/route.ts',
      'src/app/api/employees/[id]/route.ts',
      'src/app/api/employees/assignable/route.ts',
    ]) {
      const route = source(path);
      expect(route).not.toMatch(/from\('employees'\)[\s\S]{0,100}select\('[^']*\*/);
      expect(route).toContain("hasEnterprisePermission(context, 'wages.read.all')");
      expect(route).toContain("rpc('wages_read_employee_base_salaries'");
    }
  });
});
