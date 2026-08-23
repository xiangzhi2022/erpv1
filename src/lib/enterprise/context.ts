import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/db/database.types';
import type { EnterpriseId } from '@/db/enterprise-types';
import { ACTIVE_TENANT_COOKIE_NAME } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EnterpriseAccessError } from './errors';
import {
  isEnterprisePermissionCode,
  type EnterprisePermissionCode,
} from './permissions';

export interface EnterpriseMembershipRecord {
  id: string;
  tenantId: string;
  userId: string;
  displayName: string;
  status: 'invited' | 'active' | 'suspended';
  enterpriseName: string;
  enterpriseType: string;
  enterpriseStatus: string;
}

export interface EnterpriseGrantRecord {
  permission: string;
  scope_kind: string;
  site_ids: string[];
  workshop_ids: string[];
}

interface PermissionScope {
  enterprise: boolean;
  siteIds: ReadonlySet<string>;
  workshopIds: ReadonlySet<string>;
}

export interface EnterpriseContext {
  userId: string;
  enterpriseId: EnterpriseId;
  membershipId: string;
  displayName: string;
  enterpriseName: string;
  enterpriseType: string;
  grants: ReadonlySet<EnterprisePermissionCode>;
  siteIds: ReadonlySet<string>;
  workshopIds: ReadonlySet<string>;
  permissionScopes: ReadonlyMap<EnterprisePermissionCode, PermissionScope>;
}

interface SelectionResult {
  allowed: boolean;
  tenantId: string | null;
  membershipId: string | null;
}

export interface EnterpriseContextDependencies {
  getVerifiedUserId(): Promise<string | null>;
  listMemberships(userId: string): Promise<EnterpriseMembershipRecord[]>;
  authorizeSelection(enterpriseId: string): Promise<SelectionResult>;
  listGrants(enterpriseId: string): Promise<EnterpriseGrantRecord[]>;
}

export interface ResolveEnterpriseContextOptions {
  requestedEnterpriseId?: string;
}

function accessForbidden(): EnterpriseAccessError {
  return new EnterpriseAccessError(
    'ENTERPRISE_ACCESS_FORBIDDEN',
    403,
    '你没有该企业的有效访问权限',
  );
}

function buildPermissionState(rows: EnterpriseGrantRecord[]) {
  const mutableScopes = new Map<EnterprisePermissionCode, {
    enterprise: boolean;
    siteIds: Set<string>;
    workshopIds: Set<string>;
  }>();
  const allSiteIds = new Set<string>();
  const allWorkshopIds = new Set<string>();

  for (const row of rows) {
    if (!isEnterprisePermissionCode(row.permission)) continue;
    const scope = mutableScopes.get(row.permission) ?? {
      enterprise: false,
      siteIds: new Set<string>(),
      workshopIds: new Set<string>(),
    };
    if (row.scope_kind === 'enterprise') {
      scope.enterprise = true;
    }
    if (row.scope_kind === 'sites') {
      for (const siteId of row.site_ids) {
        scope.siteIds.add(siteId);
        allSiteIds.add(siteId);
      }
    }
    if (row.scope_kind === 'workshops') {
      for (const workshopId of row.workshop_ids) {
        scope.workshopIds.add(workshopId);
        allWorkshopIds.add(workshopId);
      }
    }
    mutableScopes.set(row.permission, scope);
  }

  return {
    grants: new Set(mutableScopes.keys()),
    siteIds: allSiteIds,
    workshopIds: allWorkshopIds,
    permissionScopes: new Map(mutableScopes),
  };
}

export async function resolveEnterpriseContext(
  source: EnterpriseContextDependencies,
  options: ResolveEnterpriseContextOptions = {},
): Promise<EnterpriseContext> {
  const userId = await source.getVerifiedUserId();
  if (!userId) {
    throw new EnterpriseAccessError('IDENTITY_REQUIRED', 401, '请先登录');
  }

  const memberships = await source.listMemberships(userId);
  if (memberships.length === 0) {
    throw new EnterpriseAccessError(
      'ENTERPRISE_MEMBERSHIP_REQUIRED',
      403,
      '当前账号尚未加入企业',
    );
  }

  const activeMemberships = memberships.filter(
    (membership) => membership.status === 'active' && membership.enterpriseStatus === 'active',
  );
  if (activeMemberships.length === 0) throw accessForbidden();

  let selected: EnterpriseMembershipRecord | undefined;
  if (options.requestedEnterpriseId) {
    const authorization = await source.authorizeSelection(options.requestedEnterpriseId);
    if (!authorization.allowed || authorization.tenantId !== options.requestedEnterpriseId) {
      throw accessForbidden();
    }
    selected = activeMemberships.find(
      (membership) => membership.tenantId === authorization.tenantId
        && membership.id === authorization.membershipId,
    );
    if (!selected) throw accessForbidden();
  } else if (activeMemberships.length === 1) {
    selected = activeMemberships[0];
  } else {
    throw new EnterpriseAccessError(
      'ENTERPRISE_SELECTION_REQUIRED',
      409,
      '请选择要进入的企业',
    );
  }

  const permissionState = buildPermissionState(await source.listGrants(selected.tenantId));
  return {
    userId,
    enterpriseId: selected.tenantId as EnterpriseId,
    membershipId: selected.id,
    displayName: selected.displayName,
    enterpriseName: selected.enterpriseName,
    enterpriseType: selected.enterpriseType,
    ...permissionState,
  };
}

export function requirePermission(
  context: EnterpriseContext,
  permission: EnterprisePermissionCode,
): void {
  if (!context.grants.has(permission)) {
    throw new EnterpriseAccessError(
      'ENTERPRISE_PERMISSION_DENIED',
      403,
      '没有执行该操作的权限',
    );
  }
}

export function canAccessEnterpriseSite(
  context: EnterpriseContext,
  permission: EnterprisePermissionCode,
  siteId: string,
): boolean {
  const scope = context.permissionScopes.get(permission);
  return Boolean(scope && (scope.enterprise || scope.siteIds.has(siteId)));
}

export function canAccessEnterpriseWorkshop(
  context: EnterpriseContext,
  permission: EnterprisePermissionCode,
  workshopId: string,
  siteId?: string,
): boolean {
  const scope = context.permissionScopes.get(permission);
  return Boolean(scope && (
    scope.enterprise
    || scope.workshopIds.has(workshopId)
    || (siteId ? scope.siteIds.has(siteId) : false)
  ));
}

interface MembershipQueryRow {
  id: string;
  tenant_id: string;
  user_id: string;
  display_name: string;
  status: 'invited' | 'active' | 'suspended';
  enterprise: {
    name: string;
    enterprise_type: string;
    status: string;
  } | null;
}

function createDatabaseSource(
  client: SupabaseClient<Database>,
  userAgent: string | null,
): EnterpriseContextDependencies {
  return {
    async getVerifiedUserId() {
      const { data, error } = await client.auth.getClaims();
      if (error || !data?.claims?.sub) return null;
      return data.claims.sub;
    },
    async listMemberships(userId) {
      const { data, error } = await client
        .from('enterprise_memberships')
        .select('id,tenant_id,user_id,display_name,status,enterprise:enterprises(name,enterprise_type,status)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) {
        throw new EnterpriseAccessError(
          'ENTERPRISE_CONTEXT_UNAVAILABLE',
          503,
          '企业上下文暂时不可用',
        );
      }
      return ((data ?? []) as MembershipQueryRow[]).map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        userId: row.user_id,
        displayName: row.display_name,
        status: row.status,
        enterpriseName: row.enterprise?.name ?? '未命名企业',
        enterpriseType: row.enterprise?.enterprise_type ?? '',
        enterpriseStatus: row.enterprise?.status ?? 'suspended',
      }));
    },
    async authorizeSelection(enterpriseId) {
      const { data, error } = await client.rpc('authorize_enterprise_selection', {
        target_enterprise_id: enterpriseId,
        target_idempotency_key: randomUUID(),
        target_correlation_id: randomUUID(),
        caller_user_agent: userAgent ?? undefined,
      });
      if (error) return { allowed: false, tenantId: null, membershipId: null };
      const result = data?.[0];
      return {
        allowed: result?.allowed === true,
        tenantId: result?.tenant_id ?? null,
        membershipId: result?.membership_id ?? null,
      };
    },
    async listGrants(enterpriseId) {
      const { data, error } = await client.rpc('current_enterprise_grants', {
        target_tenant_id: enterpriseId,
      });
      if (error) {
        throw new EnterpriseAccessError(
          'ENTERPRISE_CONTEXT_UNAVAILABLE',
          503,
          '企业权限暂时不可用',
        );
      }
      return data ?? [];
    },
  };
}

export async function getEnterpriseContext(): Promise<EnterpriseContext> {
  const [client, cookieStore, headerStore] = await Promise.all([
    createClient(),
    cookies(),
    headers(),
  ]);
  return resolveEnterpriseContext(
    createDatabaseSource(client, headerStore.get('user-agent')),
    { requestedEnterpriseId: cookieStore.get(ACTIVE_TENANT_COOKIE_NAME)?.value },
  );
}
