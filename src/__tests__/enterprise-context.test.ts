import { describe, expect, it, vi } from 'vitest';
import {
  canAccessEnterpriseSite,
  canAccessEnterpriseWorkshop,
  hasEnterprisePermission,
  resolveEnterpriseContext,
  type EnterpriseContextDependencies,
  type EnterpriseMembershipRecord,
} from '@/lib/enterprise/context';

const activeMembership = (overrides: Partial<EnterpriseMembershipRecord> = {}): EnterpriseMembershipRecord => ({
  id: 'membership-1',
  tenantId: '11111111-1111-4111-8111-111111111111',
  userId: 'user-1',
  displayName: '王店长',
  status: 'active',
  enterpriseName: '青崖家具',
  enterpriseType: 'manufacturer',
  enterpriseStatus: 'active',
  ...overrides,
});

function dependencies(
  memberships: EnterpriseMembershipRecord[],
  options: {
    userId?: string | null;
    selectionAllowed?: boolean;
    grants?: Array<{
      permission: string;
      scope_kind: string;
      site_ids: string[];
      workshop_ids: string[];
    }>;
  } = {},
): EnterpriseContextDependencies {
  return {
    getVerifiedUserId: vi.fn(async () => options.userId === undefined ? 'user-1' : options.userId),
    listMemberships: vi.fn(async () => memberships),
    authorizeSelection: vi.fn(async (enterpriseId) => ({
      allowed: options.selectionAllowed ?? true,
      tenantId: options.selectionAllowed === false ? null : enterpriseId,
      membershipId: options.selectionAllowed === false ? null : memberships.find((row) => row.tenantId === enterpriseId)?.id ?? null,
    })),
    listGrants: vi.fn(async () => options.grants ?? [{
      permission: 'dashboard.read',
      scope_kind: 'enterprise',
      site_ids: [],
      workshop_ids: [],
    }]),
  };
}

describe('authoritative enterprise context', () => {
  it('requires a verified Supabase identity', async () => {
    await expect(resolveEnterpriseContext(dependencies([], { userId: null }))).rejects.toMatchObject({
      code: 'IDENTITY_REQUIRED',
      status: 401,
    });
  });

  it('rejects an identity with no enterprise membership', async () => {
    await expect(resolveEnterpriseContext(dependencies([]))).rejects.toMatchObject({
      code: 'ENTERPRISE_MEMBERSHIP_REQUIRED',
      status: 403,
    });
  });

  it('rejects suspended memberships and enterprises', async () => {
    await expect(resolveEnterpriseContext(dependencies([
      activeMembership({ status: 'suspended' }),
    ]))).rejects.toMatchObject({ code: 'ENTERPRISE_ACCESS_FORBIDDEN' });

    await expect(resolveEnterpriseContext(dependencies([
      activeMembership({ enterpriseStatus: 'suspended' }),
    ]))).rejects.toMatchObject({ code: 'ENTERPRISE_ACCESS_FORBIDDEN' });
  });

  it('defaults a sole active membership without trusting a client selector', async () => {
    const source = dependencies([activeMembership()]);

    const context = await resolveEnterpriseContext(source);

    expect(context.enterpriseId).toBe('11111111-1111-4111-8111-111111111111');
    expect(context.membershipId).toBe('membership-1');
    expect(source.authorizeSelection).not.toHaveBeenCalled();
  });

  it('requires an explicit choice when multiple memberships are active', async () => {
    const source = dependencies([
      activeMembership(),
      activeMembership({
        id: 'membership-2',
        tenantId: '22222222-2222-4222-8222-222222222222',
        enterpriseName: '第二企业',
      }),
    ]);

    await expect(resolveEnterpriseContext(source)).rejects.toMatchObject({
      code: 'ENTERPRISE_SELECTION_REQUIRED',
      status: 409,
    });
  });

  it('validates a requested enterprise through the database and rejects a tampered cookie', async () => {
    const source = dependencies([activeMembership()], { selectionAllowed: false });

    await expect(resolveEnterpriseContext(source, {
      requestedEnterpriseId: '99999999-9999-4999-8999-999999999999',
    })).rejects.toMatchObject({ code: 'ENTERPRISE_ACCESS_FORBIDDEN', status: 403 });
    expect(source.authorizeSelection).toHaveBeenCalledWith('99999999-9999-4999-8999-999999999999');
  });

  it('accepts an authorized enterprise switch and returns database grants', async () => {
    const second = activeMembership({
      id: 'membership-2',
      tenantId: '22222222-2222-4222-8222-222222222222',
      enterpriseName: '第二企业',
    });
    const source = dependencies([activeMembership(), second], {
      grants: [{ permission: 'orders.read', scope_kind: 'enterprise', site_ids: [], workshop_ids: [] }],
    });

    const context = await resolveEnterpriseContext(source, { requestedEnterpriseId: second.tenantId });

    expect(context.enterpriseId).toBe(second.tenantId);
    expect(context.grants).toEqual(new Set(['orders.read']));
    expect(source.authorizeSelection).toHaveBeenCalledWith(second.tenantId);
  });

  it('preserves site and workshop scope for permission checks', async () => {
    const source = dependencies([activeMembership()], {
      grants: [
        { permission: 'production.read', scope_kind: 'sites', site_ids: ['site-1'], workshop_ids: [] },
        { permission: 'production.report.self', scope_kind: 'workshops', site_ids: [], workshop_ids: ['workshop-1'] },
      ],
    });

    const context = await resolveEnterpriseContext(source);

    expect(context.siteIds).toEqual(new Set(['site-1']));
    expect(context.workshopIds).toEqual(new Set(['workshop-1']));
    expect(canAccessEnterpriseSite(context, 'production.read', 'site-1')).toBe(true);
    expect(canAccessEnterpriseSite(context, 'production.read', 'site-2')).toBe(false);
    expect(canAccessEnterpriseWorkshop(context, 'production.read', 'workshop-2', 'site-1')).toBe(true);
    expect(canAccessEnterpriseWorkshop(context, 'production.report.self', 'workshop-1')).toBe(true);
    expect(canAccessEnterpriseWorkshop(context, 'production.report.self', 'workshop-2')).toBe(false);
    expect(hasEnterprisePermission(context, 'production.read')).toBe(false);
    expect(hasEnterprisePermission(context, 'production.report.self')).toBe(false);
  });

  it('distinguishes enterprise-wide grants from scoped grants', async () => {
    const context = await resolveEnterpriseContext(dependencies([activeMembership()], {
      grants: [
        { permission: 'finance.read', scope_kind: 'enterprise', site_ids: [], workshop_ids: [] },
        { permission: 'finance.manage', scope_kind: 'workshops', site_ids: [], workshop_ids: ['workshop-1'] },
      ],
    }));

    expect(hasEnterprisePermission(context, 'finance.read')).toBe(true);
    expect(hasEnterprisePermission(context, 'finance.manage')).toBe(false);
  });
});
