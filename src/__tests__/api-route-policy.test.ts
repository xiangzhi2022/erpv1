import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  API_ROUTE_POLICIES,
  API_ROUTE_POLICY_ENTRIES,
  getApiRoutePolicy,
} from '@/lib/api/route-policy';

const API_ROOT = resolve(process.cwd(), 'src/app/api');

function routeFiles(directory = API_ROOT): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === 'route.ts' ? [path] : [];
  });
}

function routePath(file: string): string {
  const directory = relative(API_ROOT, file).split(sep).slice(0, -1).join('/');
  return `/api/${directory}`;
}

describe('API route policy manifest', () => {
  it('contains one exact policy for every route and no stale entries', () => {
    const actual = routeFiles().map(routePath).sort();
    const declared = Object.keys(API_ROUTE_POLICIES).sort();
    const entryPaths = API_ROUTE_POLICY_ENTRIES.map(([path]) => path);

    expect(new Set(entryPaths).size).toBe(entryPaths.length);
    expect(declared).toEqual(actual);
  });

  it('allows anonymous access only to authentication initiation and callbacks', () => {
    const publicPaths = Object.entries(API_ROUTE_POLICIES)
      .filter(([, policy]) => policy.access === 'public')
      .map(([path]) => path);

    expect(publicPaths.length).toBeGreaterThan(0);
    expect(publicPaths.every((path) => path.startsWith('/api/auth/'))).toBe(true);
    expect(API_ROUTE_POLICIES['/api/ppt-fetch']).toBeUndefined();
    expect(API_ROUTE_POLICIES['/api/test/db']).toBeUndefined();
    expect(Object.entries(API_ROUTE_POLICIES)
      .filter(([path]) => path.startsWith('/api/debug/'))
      .every(([, policy]) => policy.access === 'development')).toBe(true);
  });

  it('matches dynamic routes and selects operation-specific permissions', () => {
    expect(getApiRoutePolicy('/api/orders/123', 'GET')).toMatchObject({
      access: 'enterprise',
      permission: 'orders.read',
    });
    expect(getApiRoutePolicy('/api/orders/123', 'PATCH')).toMatchObject({
      access: 'enterprise',
      permission: 'orders.update',
    });
    expect(getApiRoutePolicy('/api/factory/workshops/123', 'GET')).toMatchObject({
      access: 'enterprise',
      permission: 'production.read',
    });
    expect(getApiRoutePolicy('/api/factory/workshops/123', 'PUT')).toMatchObject({
      access: 'enterprise',
      permission: 'production.manage',
    });
    expect(getApiRoutePolicy('/api/not-declared', 'GET')).toBeNull();
  });

  it('prefers concrete routes and exposes any-of permissions for mixed mutations', () => {
    expect(getApiRoutePolicy('/api/dealer/orders/create', 'POST')).toMatchObject({
      permission: 'orders.create',
    });
    expect(getApiRoutePolicy('/api/supplier/orders', 'GET')).toMatchObject({
      permission: 'orders.read',
    });
    expect(getApiRoutePolicy('/api/factory/orders', 'POST')).toMatchObject({
      permission: 'orders.accept',
    });
    expect(getApiRoutePolicy('/api/order-exchanges', 'POST')).toMatchObject({
      permission: 'orders.submit',
    });
    expect(getApiRoutePolicy('/api/order-exchanges/exchange-id', 'PATCH')?.permissions).toEqual([
      'orders.update',
      'orders.accept',
    ]);
    expect(getApiRoutePolicy('/api/orders/basic', 'POST')?.permissions).toEqual([
      'orders.create',
      'orders.update',
    ]);
    expect(getApiRoutePolicy('/api/orders', 'POST')?.permissions).toEqual([
      'orders.create',
      'orders.update',
    ]);
    expect(getApiRoutePolicy('/api/orders/generate', 'POST')).toMatchObject({ permission: 'orders.create' });
    expect(getApiRoutePolicy('/api/orders/sequence', 'GET')).toMatchObject({ permission: 'orders.create' });
    expect(getApiRoutePolicy('/api/orders/prefix', 'GET')).toMatchObject({ permission: 'catalog.read' });
    expect(getApiRoutePolicy('/api/orders/123/spaces', 'POST')).toMatchObject({ permission: 'orders.update' });
    expect(getApiRoutePolicy('/api/spaces/123/products', 'POST')).toMatchObject({ permission: 'orders.update' });
  });

  it('uses operation-specific production and wage permissions', () => {
    expect(getApiRoutePolicy('/api/production/eligible-workers', 'GET')).toMatchObject({ permission: 'production.assign' });
    expect(getApiRoutePolicy('/api/production/tasks/task-id/assign', 'PATCH')).toMatchObject({ permission: 'production.assign' });
    expect(getApiRoutePolicy('/api/production/tasks/task-id/approve', 'PATCH')).toMatchObject({ permission: 'production.review' });
    expect(getApiRoutePolicy('/api/production/tasks/task-id/rework', 'PATCH')).toMatchObject({ permission: 'production.review' });
    expect(getApiRoutePolicy('/api/production/tasks/task-id/start', 'PATCH')).toMatchObject({ permission: 'production.report.self' });
    expect(getApiRoutePolicy('/api/production/tasks/task-id/submit', 'PATCH')).toMatchObject({ permission: 'production.report.self' });
    expect(getApiRoutePolicy('/api/progress/report', 'POST')).toMatchObject({
      permissions: [
        'production.report.self',
        'production.review',
        'shipping.manage',
        'production.manage',
      ],
    });
    expect(getApiRoutePolicy('/api/worker/report', 'POST')).toMatchObject({ permission: 'production.report.self' });
    expect(getApiRoutePolicy('/api/worker/me/wages', 'GET')).toMatchObject({ permission: 'wages.read.self' });
    expect(getApiRoutePolicy('/api/workers/worker-id/wages', 'GET')).toMatchObject({ permission: 'wages.read.all' });
    expect(getApiRoutePolicy('/api/wage-rules', 'GET')).toMatchObject({ permission: 'wages.manage' });
    expect(getApiRoutePolicy('/api/wages/calculate', 'POST')).toMatchObject({ permission: 'wages.manage' });
    expect(getApiRoutePolicy('/api/finance/settlements', 'POST')).toMatchObject({ permission: 'wages.settle' });
    expect(getApiRoutePolicy('/api/finance/wage-records/wage-id/pay', 'PATCH')).toMatchObject({ permission: 'wages.settle' });
  });

  it('allows recipients to mark notifications while keeping overdue checks service-guarded', () => {
    expect(getApiRoutePolicy('/api/notifications/notification-id', 'PATCH')).toMatchObject({
      permissions: ['notifications.read'],
    });
    expect(getApiRoutePolicy('/api/notifications', 'POST')).toMatchObject({
      permissions: ['notifications.read', 'tasks.manage', 'notifications.manage'],
    });
  });

  it('rejects raw JSON parsing in mutation route handlers', () => {
    const offenders = routeFiles().filter((file) => {
      const source = readFileSync(file, 'utf8');
      const hasMutation = /export\s+(?:async\s+function|const)\s+(POST|PUT|PATCH|DELETE)\b/.test(source);
      return hasMutation && /(?:request|req)\.json\s*\(/.test(source);
    }).map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('keeps the Supabase admin client out of routes and Server Actions', () => {
    const roots = [resolve(process.cwd(), 'src/app/api'), resolve(process.cwd(), 'src/app/actions')];
    const sourceFiles = roots.flatMap((root) => {
      function walk(directory: string): string[] {
        return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
          const path = join(directory, entry.name);
          return entry.isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
        });
      }
      return walk(root);
    });
    const offenders = sourceFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /getSupabaseServiceClient|@\/lib\/supabase\/admin|SUPABASE_SECRET_KEY|service_role/.test(source);
    }).map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('uses request-scoped Supabase access for migrated internal-work APIs', () => {
    const internalRoots = [
      'categories',
      'customers',
      'dashboard',
      'notifications',
      'products',
      'tasks',
    ].map((directory) => resolve(API_ROOT, directory));
    const files = internalRoots.flatMap((root) => routeFiles(root));
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /@\/db\/client|getSupabaseClient\s*\(|getUserFromRequest\s*\(/.test(source);
    }).map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('uses request-scoped Supabase access for migrated identity and admin APIs', () => {
    const adminRoots = [
      'departments',
      'employees',
      'organization-requests',
      'permissions',
      'positions',
      'roles',
      'settings',
    ].map((directory) => resolve(API_ROOT, directory));
    const files = adminRoots.flatMap((root) => routeFiles(root));
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /@\/db\/client|getSupabaseClient\s*\(|createAdminClient\s*\(/.test(source);
    }).map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('uses request-scoped Supabase access for partner directory mutations', () => {
    const files = [
      resolve(API_ROOT, 'dealer/route.ts'),
      resolve(API_ROOT, 'dealer/[id]/route.ts'),
      resolve(API_ROOT, 'enterprise-directory/route.ts'),
      resolve(API_ROOT, 'factories/route.ts'),
      resolve(API_ROOT, 'order-exchanges/partners/route.ts'),
      resolve(API_ROOT, 'order-partners/route.ts'),
      resolve(API_ROOT, 'supplier/create/route.ts'),
      resolve(API_ROOT, 'supplier/delete/route.ts'),
      resolve(API_ROOT, 'supplier/list/route.ts'),
      resolve(API_ROOT, 'supplier/update/route.ts'),
    ];
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /@\/db\/client|getSupabaseClient\s*\(|\btenant_id\b/.test(source);
    }).map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('keeps factory workshop access enterprise-scoped and out of admin REST helpers', () => {
    const files = [
      resolve(API_ROOT, 'factory/workshops/route.ts'),
      resolve(API_ROOT, 'factory/workshops/[id]/route.ts'),
    ];
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /getFactoryWorkshopAdmin|getUserFromRequest|@\/db\/client|getSupabaseClient\s*\(/.test(source)
        || !/enterprise_id/.test(source);
    }).map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('uses enterprise-scoped access for migrated order reads and numbering', () => {
    const files = [
      resolve(API_ROOT, 'dealer/orders/route.ts'),
      resolve(API_ROOT, 'dealer/orders/[id]/route.ts'),
      resolve(API_ROOT, 'dealer/orders/create/route.ts'),
      resolve(API_ROOT, 'factory/orders/route.ts'),
      resolve(API_ROOT, 'order-exchanges/route.ts'),
      resolve(API_ROOT, 'order-exchanges/[id]/route.ts'),
      resolve(API_ROOT, 'supplier/orders/route.ts'),
      resolve(API_ROOT, 'orders/route.ts'),
      resolve(API_ROOT, 'orders/[id]/route.ts'),
      resolve(API_ROOT, 'orders/generate/route.ts'),
      resolve(API_ROOT, 'orders/basic/route.ts'),
      resolve(API_ROOT, 'orders/prefix/route.ts'),
      resolve(API_ROOT, 'orders/sequence/route.ts'),
      resolve(API_ROOT, 'orders/[id]/spaces/route.ts'),
      resolve(API_ROOT, 'orders/[id]/split/confirm/route.ts'),
      resolve(API_ROOT, 'orders/attachments/route.ts'),
      resolve(API_ROOT, 'spaces/[id]/products/route.ts'),
      resolve(API_ROOT, 'spaces/[id]/route.ts'),
    ];
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /@\/db\/client|getSupabaseClient\s*\(|\.select\([^)]*(?:tenant_id|from_tenant_id|to_tenant_id)|\.(?:eq|is)\(['"](?:tenant_id|from_tenant_id|to_tenant_id)['"]/.test(source);
    }).map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });

  it('uses request-scoped enterprise access for production and finance APIs', () => {
    const roots = [
      'finance',
      'performance',
      'production',
      'progress',
      'wage-records',
      'wage-rules',
      'wages',
      'worker',
    ].map((directory) => resolve(API_ROOT, directory));
    const files = [
      ...roots.flatMap((root) => routeFiles(root)),
      resolve(API_ROOT, 'workers/[id]/wages/route.ts'),
    ];
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /@\/db\/client|getSupabaseClient\s*\(|getUserFromRequest\s*\(|\.(?:eq|is)\(['"]tenant_id['"]/.test(source);
    }).map((file) => relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});
