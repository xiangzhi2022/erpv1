import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ENTERPRISE_ID = '10000000-0000-4000-8000-000000000001';
const ROLE_ID = '20000000-0000-4000-8000-000000000002';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: vi.fn(async () => ({
    enterpriseId: ENTERPRISE_ID,
    grants: new Set(['roles.manage']),
  })),
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mocks.from, rpc: mocks.rpc })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('atomic enterprise role management', () => {
  it('creates a role through the guarded database RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: ROLE_ID,
        tenant_id: ENTERPRISE_ID,
        code: 'sales_lead',
        name: '销售主管',
        description: null,
        is_system: false,
      },
      error: null,
    });
    const { POST } = await import('@/app/api/roles/route');

    const response = await POST(new Request('https://erp.example.com/api/roles', {
      method: 'POST',
      body: JSON.stringify({ code: 'sales_lead', name: '销售主管' }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith('create_enterprise_role', {
      target_code: 'sales_lead',
      target_description: null,
      target_enterprise_id: ENTERPRISE_ID,
      target_name: '销售主管',
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('updates role metadata through one guarded database RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: ROLE_ID,
        tenant_id: ENTERPRISE_ID,
        code: 'sales_lead',
        name: '销售负责人',
        description: null,
        is_system: false,
      },
      error: null,
    });
    const { PATCH } = await import('@/app/api/roles/[id]/route');

    const response = await PATCH(new Request(`https://erp.example.com/api/roles/${ROLE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '销售负责人', description: null }),
    }), { params: Promise.resolve({ id: ROLE_ID }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('update_enterprise_role', {
      target_code: null,
      target_description: null,
      target_enterprise_id: ENTERPRISE_ID,
      target_name: '销售负责人',
      target_role_id: ROLE_ID,
      update_code: false,
      update_description: true,
      update_name: true,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('replaces permissions atomically through one guarded database RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: ['members.read', 'roles.manage'],
      error: null,
    });
    const { PATCH } = await import('@/app/api/roles/[id]/permissions/route');

    const response = await PATCH(new Request(`https://erp.example.com/api/roles/${ROLE_ID}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify({
        permission_codes: ['roles.manage', 'members.read', 'roles.manage'],
      }),
    }), { params: Promise.resolve({ id: ROLE_ID }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('set_enterprise_role_permissions', {
      target_enterprise_id: ENTERPRISE_ID,
      target_permission_codes: ['roles.manage', 'members.read'],
      target_role_id: ROLE_ID,
    });
    expect(mocks.from).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: ['members.read', 'roles.manage'],
    });
  });
});

describe('role management database boundary', () => {
  it('keeps authenticated writes RPC-only and exposes only guarded functions', () => {
    const migration = readFileSync(resolve(
      process.cwd(),
      'supabase/migrations/20260823157000_role_permission_boundaries.sql',
    ), 'utf8');

    expect(migration).toMatch(/revoke insert, update, delete on table[\s\S]*public\.roles,[\s\S]*public\.role_permissions[\s\S]*from authenticated/i);
    expect(migration).toMatch(/create function public\.create_enterprise_role\([\s\S]*security definer[\s\S]*set search_path = pg_catalog/i);
    expect(migration).toMatch(/create function public\.update_enterprise_role\([\s\S]*security definer[\s\S]*set search_path = pg_catalog/i);
    expect(migration).toMatch(/create function public\.set_enterprise_role_permissions\([\s\S]*security definer[\s\S]*set search_path = pg_catalog/i);
    expect(migration).toContain("app_private.has_enterprise_permission(target_enterprise_id, 'roles.manage')");
    expect(migration).toContain('app_private.actor_is_enterprise_owner(target_enterprise_id)');
    expect(migration).toMatch(/if not app_private\.actor_is_enterprise_owner\(target_enterprise_id\)[\s\S]*permission_not_assignable/i);
    expect(migration).toContain("permission_code = any(array['roles.manage','members.manage']::text[])");
    expect(migration).toMatch(/revoke all on function public\.set_enterprise_role_permissions\([\s\S]*from public, anon, authenticated, service_role/i);
    expect(migration).toMatch(/grant execute on function public\.set_enterprise_role_permissions\([\s\S]*to authenticated/i);
  });
});
