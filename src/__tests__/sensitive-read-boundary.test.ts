import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const migrationPath = resolve(root, 'supabase/migrations/20260823151000_sensitive_read_boundary.sql');
const scopeMigrationPath = resolve(root, 'supabase/migrations/20260823158000_sensitive_scope_rls.sql');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

function typescriptFiles(path: string): string[] {
  return readdirSync(path).flatMap((entry) => {
    const target = resolve(path, entry);
    if (statSync(target).isDirectory()) return typescriptFiles(target);
    return /\.(?:ts|tsx)$/.test(entry) ? [target] : [];
  });
}

describe('sensitive Data API read boundary', () => {
  it('requires enterprise-scoped reads for sensitive rows without a site or workshop mapping', () => {
    expect(existsSync(scopeMigrationPath)).toBe(true);
    const migration = existsSync(scopeMigrationPath) ? readFileSync(scopeMigrationPath, 'utf8') : '';

    for (const [table, permission] of [
      ['orders', 'orders.read'],
      ['order_items', 'orders.read'],
      ['order_products', 'orders.read'],
      ['employees', 'members.read'],
    ] as const) {
      const policy = migration.match(new RegExp(
        `create policy ${table}_select[\\s\\S]+?;\\n`,
        'i',
      ))?.[0] ?? '';
      expect(policy).toContain(`app_private.has_enterprise_permission(${table}.enterprise_id, '${permission}')`);
      expect(policy).not.toContain('app_private.has_permission(');
    }

    for (const operation of ['select', 'insert', 'update', 'delete']) {
      const customerPolicy = migration.match(new RegExp(
        `create policy customers_${operation}[\\s\\S]+?;\\n`,
        'i',
      ))?.[0] ?? '';
      expect(customerPolicy).toContain('app_private.has_enterprise_permission(');
      expect(customerPolicy).not.toContain('app_private.has_permission(');
    }
    const exchangePolicy = migration.match(
      /create policy order_exchanges_participant_select[\s\S]+?;\n/i,
    )?.[0] ?? '';
    expect(exchangePolicy).toContain("has_enterprise_permission(order_exchanges.from_enterprise_id, 'orders.read')");
    expect(exchangePolicy).toContain("has_enterprise_permission(order_exchanges.to_enterprise_id, 'orders.read')");
    for (const table of [
      'order_spaces', 'order_modules', 'order_item_attachments', 'order_status_logs',
      'departments', 'positions', 'employee_positions', 'employee_roles',
      'suppliers', 'dealers', 'wage_rules', 'order_prefixes', 'categories',
      'tasks', 'factory_workshops', 'user_settings',
    ]) {
      expect(migration).toContain(`('${table}',`);
    }
    expect(migration).toMatch(/create policy %I[\s\S]+for select to authenticated using \(app_private\.has_enterprise_permission\(enterprise_id, %L\)\)/i);
    expect(migration).toMatch(/create policy %I[\s\S]+for insert to authenticated with check \(app_private\.has_enterprise_permission\(enterprise_id, %L\)\)/i);
    const profilePolicy = migration.match(
      /create policy profiles_update[\s\S]+?;\n/i,
    )?.[0] ?? '';
    expect(profilePolicy).toContain('app_private.has_enterprise_permission(');
    expect(profilePolicy).not.toContain('app_private.has_permission(');
    expect(migration).toMatch(/revoke insert, update, delete on table public\.profiles from authenticated/i);
    expect(migration).not.toMatch(/create policy profiles_(?:insert|delete)/i);
    const profileUpdateGrant = migration.match(
      /grant update\s*\(([^)]+)\)\s+on table public\.profiles to authenticated/i,
    )?.[1] ?? '';
    expect(profileUpdateGrant).not.toMatch(/\bid\b|enterprise_id/);
  });

  it('ships a follow-up migration that removes direct sensitive column reads', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

    for (const table of ['orders', 'order_items', 'order_products', 'production_tasks']) {
      expect(migration).toMatch(new RegExp(
        `revoke\\s+select\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+authenticated`,
        'i',
      ));
    }
    const orderGrant = migration.match(/grant\s+select\s*\(([^)]+)\)\s+on\s+table\s+public\.orders/i)?.[1] ?? '';
    expect(orderGrant).toContain('total_amount');
    expect(orderGrant).not.toMatch(/cost_amount|profit_amount|internal_remark|deposit_amount/);
    const itemGrant = migration.match(/grant\s+select\s*\(([^)]+)\)\s+on\s+table\s+public\.order_items/i)?.[1] ?? '';
    expect(itemGrant).toContain('product_name');
    expect(itemGrant).not.toMatch(/unit_price|subtotal/);
    const productGrant = migration.match(/grant\s+select\s*\(([^)]+)\)\s+on\s+table\s+public\.order_products/i)?.[1] ?? '';
    expect(productGrant).toContain('product_name');
    expect(productGrant).not.toMatch(/quoted_amount|cost_amount|profit_amount|internal_remark/);
    const taskGrant = migration.match(/grant\s+select\s*\(([^)]+)\)\s+on\s+table\s+public\.production_tasks/i)?.[1] ?? '';
    expect(taskGrant).toContain('task_name');
    expect(taskGrant).not.toMatch(/wage_rule_id|estimated_wage_amount|final_wage_amount/);
  });

  it('provides hardened permission-specific tenant/order read RPCs', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    expect(migration).toContain('create function public.finance_read_order_details(');
    expect(migration).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'finance.read')");
    expect(migration).toContain('create function public.wages_read_order_task_amounts(');
    expect(migration).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'wages.read.all')");
    expect(migration).toContain('create function public.finance_list_order_item_amounts(');
    expect(migration.match(/security definer/gi)).toHaveLength(7);
    expect(migration.match(/set search_path = pg_catalog/gi)).toHaveLength(7);
    expect(migration).toMatch(/create or replace function public\.finance_list_order_summaries[\s\S]+?has_enterprise_permission\(target_enterprise_id, 'finance\.read'\)/i);
    for (const functionName of ['finance_list_wages', 'finance_list_settlements']) {
      const functionSource = migration.match(new RegExp(
        `create or replace function public\\.${functionName}[\\s\\S]+?end;\\n\\$\\$;`,
        'i',
      ))?.[0] ?? '';
      expect(functionSource).toContain("has_enterprise_permission(target_enterprise_id, 'finance.read')");
      expect(functionSource).toContain("has_enterprise_permission(target_enterprise_id, 'wages.read.all')");
    }
    expect(migration).toMatch(/revoke all on function public\.finance_read_order_details[\s\S]+?from public, anon, authenticated, service_role/i);
    expect(migration).toMatch(/revoke all on function public\.wages_read_order_task_amounts[\s\S]+?from public, anon, authenticated, service_role/i);
    expect(migration).toMatch(/revoke all on function public\.finance_list_order_item_amounts[\s\S]+?from public, anon, authenticated, service_role/i);
    expect(migration).toMatch(/alter function public\.finance_list_order_item_amounts\(uuid, uuid\[\]\) owner to v2_function_owner/i);
    expect(migration).toMatch(/grant execute on function public\.finance_list_order_item_amounts\(uuid, uuid\[\]\) to authenticated/i);
    expect(source('src/db/database.types.ts')).toContain('finance_list_order_item_amounts: {');
  });

  it('limits production.read-only users to tasks assigned to their own worker row', () => {
    const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';
    const policy = migration.match(/create policy production_tasks_select[\s\S]+?;\n/i)?.[0] ?? '';
    for (const permission of ['production.plan', 'production.assign', 'production.review', 'production.manage']) {
      expect(policy).toContain(`'${permission}'`);
    }
    expect(policy).toContain("app_private.can_access_workshop(");
    expect(policy).toContain("app_private.has_enterprise_permission(");
    expect(policy).toContain('worker.user_id = (select auth.uid())');
    expect(policy).toMatch(/production_tasks\.(?:assigned_worker_id|worker_id)/);

    const wagePolicy = migration.match(/create policy worker_wage_records_select[\s\S]+?;\n/i)?.[0] ?? '';
    expect(wagePolicy).toContain("has_enterprise_permission(worker_wage_records.enterprise_id, 'wages.read.all')");
    expect(wagePolicy).toContain('app_private.effective_grants(worker_wage_records.enterprise_id)');
    expect(wagePolicy).toMatch(/scope_kind\s+in\s+\('enterprise',\s*'self'\)/);
    expect(wagePolicy).toContain('worker.user_id = (select auth.uid())');
  });

  it('uses safe base selects and permission-gated RPC enrichment', () => {
    const detail = source('src/app/api/orders/[id]/route.ts');
    expect(detail).toContain("rpc('finance_read_order_details'");
    expect(detail).toContain("rpc('wages_read_order_task_amounts'");
    expect(detail).not.toMatch(/from\('orders'\)[\s\S]{0,80}\.select\('\*'\)/);
    expect(detail).not.toMatch(/from\('order_products'\)[\s\S]{0,80}\.select\('\*'\)/);
    expect(detail).not.toMatch(/from\('production_tasks'\)[\s\S]{0,80}\.select\('\*'\)/);

    const dashboard = source('src/app/api/dashboard/summary/route.ts');
    const financeSummary = source('src/app/api/dashboard/finance-summary/route.ts');
    expect(dashboard).toContain("hasEnterprisePermission(context, 'finance.read')");
    expect(dashboard).toContain("hasEnterprisePermission(context, 'wages.read.all')");
    expect(financeSummary).toContain("hasEnterprisePermission(context, 'finance.read')");
    expect(financeSummary).toContain("hasEnterprisePermission(context, 'wages.read.all')");

    const factoryOrders = source('src/app/api/factory/orders/route.ts');
    expect(factoryOrders).toContain("hasEnterprisePermission(context, 'finance.read')");
    expect(factoryOrders).toContain("rpc('finance_list_order_item_amounts'");
    expect(factoryOrders).not.toContain("rpc('finance_read_order_details'");
  });

  it('does not use wildcard or explicit sensitive base-table reads in server code', () => {
    const serverFiles = [
      'src/app/api/orders/[id]/route.ts',
      'src/app/api/orders/[id]/split/confirm/route.ts',
      'src/lib/four-level-order-server.ts',
    ];
    const combined = serverFiles.map(source).join('\n');
    for (const table of ['orders', 'order_products', 'production_tasks']) {
      expect(combined).not.toMatch(new RegExp(
        `from\\('${table}'\\)[\\s\\S]{0,80}select\\('\\*'\\)`,
      ));
    }
    expect(combined).not.toMatch(/from\('orders'\)[\s\S]{0,120}select\('[^']*(?:deposit_amount|cost_amount|profit_amount|internal_remark)/);
    expect(combined).not.toMatch(/from\('order_products'\)[\s\S]{0,120}select\('[^']*(?:quoted_amount|cost_amount|profit_amount|internal_remark)/);
    expect(combined).not.toMatch(/from\('production_tasks'\)[\s\S]{0,120}select\('[^']*(?:wage_rule_id|estimated_wage_amount|final_wage_amount)/);
    expect(combined).not.toMatch(/from\('order_items'\)[\s\S]{0,120}select\('[^']*(?:unit_price|subtotal)/);

    const productionServerFiles = [
      ...typescriptFiles(resolve(root, 'src/app/api')),
      ...typescriptFiles(resolve(root, 'src/lib')),
    ];
    for (const path of productionServerFiles) {
      const contents = readFileSync(path, 'utf8');
      for (const table of ['orders', 'order_items', 'order_products', 'production_tasks']) {
        expect(contents, path).not.toMatch(new RegExp(
          `from\\('${table}'\\)(?:(?!\\.from\\()[\\s\\S]){0,160}\\.select\\((?:'\\*')?\\)`,
        ));
      }
    }
  });
});
