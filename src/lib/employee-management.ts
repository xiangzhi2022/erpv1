import type { EnterpriseContext } from '@/lib/enterprise/context';
import {
  createManagedIdentity,
  findManagedIdentityByPhone,
} from '@/lib/admin/user-identities';
import { createClient } from '@/lib/supabase/server';

export interface EmployeeRoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  tenant_id: string;
}

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeEmployeeAccountPhone(value: unknown): string | null {
  const phone = text(value)?.replace(/\D/g, '') || null;
  return phone && /^1[3-9]\d{9}$/.test(phone) ? phone : null;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )))
    : [];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function ensureEmployeeRoleRows(
  roleIdsOrCodes: string[],
  context: EnterpriseContext,
): Promise<EmployeeRoleRow[]> {
  if (roleIdsOrCodes.length === 0) return [];
  const client = await createClient();
  const ids = roleIdsOrCodes.filter(isUuid);
  const codes = roleIdsOrCodes.filter((value) => !isUuid(value));
  let query = client
    .from('roles')
    .select('id,code,name,description,tenant_id')
    .eq('tenant_id', context.enterpriseId);
  if (ids.length > 0 && codes.length > 0) {
    query = query.or(`id.in.(${ids.join(',')}),code.in.(${codes.join(',')})`);
  } else if (ids.length > 0) {
    query = query.in('id', ids);
  } else {
    query = query.in('code', codes);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length !== roleIdsOrCodes.length) {
    throw new Error('包含无效或无权分配的角色');
  }
  return rows;
}

export async function replaceEmployeeRelations(
  employeeId: string,
  roleIdsOrCodes: string[],
  positionIds: string[],
  primaryPositionId: string | null,
  context: EnterpriseContext,
): Promise<EmployeeRoleRow[]> {
  const client = await createClient();
  const roles = await ensureEmployeeRoleRows(roleIdsOrCodes, context);

  const { error: clearPositionsError } = await client
    .from('employee_positions')
    .delete()
    .eq('enterprise_id', context.enterpriseId)
    .eq('employee_id', employeeId);
  if (clearPositionsError) throw clearPositionsError;
  if (positionIds.length > 0) {
    const { error } = await client.from('employee_positions').insert(
      positionIds.map((positionId) => ({
        enterprise_id: context.enterpriseId,
        employee_id: employeeId,
        position_id: positionId,
        is_primary: positionId === primaryPositionId,
      })),
    );
    if (error) throw error;
  }

  const { error: clearRolesError } = await client
    .from('employee_roles')
    .delete()
    .eq('enterprise_id', context.enterpriseId)
    .eq('employee_id', employeeId);
  if (clearRolesError) throw clearRolesError;
  if (roles.length > 0) {
    const { error } = await client.from('employee_roles').insert(
      roles.map((role) => ({
        enterprise_id: context.enterpriseId,
        employee_id: employeeId,
        role_id: role.id,
      })),
    );
    if (error) throw error;
  }

  return roles;
}

export async function syncEmployeeRoleBindings(
  userId: string | null,
  roles: EmployeeRoleRow[],
  context: EnterpriseContext,
): Promise<void> {
  if (!userId) return;
  const client = await createClient();
  const { data: membership, error: membershipError } = await client
    .from('enterprise_memberships')
    .select('id')
    .eq('tenant_id', context.enterpriseId)
    .eq('user_id', userId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error('员工登录账号尚未加入当前企业');

  const { error: clearError } = await client
    .from('role_bindings')
    .delete()
    .eq('tenant_id', context.enterpriseId)
    .eq('membership_id', membership.id)
    .eq('scope_kind', 'enterprise');
  if (clearError) throw clearError;
  if (roles.length === 0) return;

  const { error } = await client.from('role_bindings').insert(
    roles.map((role) => ({
      tenant_id: context.enterpriseId,
      membership_id: membership.id,
      role_id: role.id,
      scope_kind: 'enterprise',
    })),
  );
  if (error) throw error;
}

async function ensureEnterpriseMembership(input: {
  context: EnterpriseContext;
  userId: string;
  phone: string;
  name: string | null;
}): Promise<void> {
  const client = await createClient();
  const { data: existing, error: findError } = await client
    .from('enterprise_memberships')
    .select('id')
    .eq('tenant_id', input.context.enterpriseId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (findError) throw findError;

  const row = {
    display_name: input.name || input.phone,
    status: 'active' as const,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await client
      .from('enterprise_memberships')
      .update(row)
      .eq('tenant_id', input.context.enterpriseId)
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await client.from('enterprise_memberships').insert({
    tenant_id: input.context.enterpriseId,
    user_id: input.userId,
    ...row,
  });
  if (error) throw error;
}

export async function ensureTenantMembership(input: {
  tenantId: string | null | undefined;
  userId: string | null | undefined;
  phone: string | null | undefined;
  name?: string | null;
  role?: string | null;
  department?: string | null;
}): Promise<void> {
  if (!input.tenantId || !input.userId) return;
  const client = await createClient();
  const { data: existing, error: findError } = await client
    .from('enterprise_memberships')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (findError) throw findError;
  const row = {
    display_name: input.name || input.phone || '员工',
    status: 'active' as const,
    updated_at: new Date().toISOString(),
  };
  const mutation = existing
    ? client.from('enterprise_memberships').update(row).eq('tenant_id', input.tenantId).eq('id', existing.id)
    : client.from('enterprise_memberships').insert({
        tenant_id: input.tenantId,
        user_id: input.userId,
        ...row,
      });
  const { error } = await mutation;
  if (error) throw error;
}

export async function createOrReuseEmployeeLoginUser(
  body: Record<string, unknown>,
  context: EnterpriseContext,
): Promise<string | null> {
  const shouldCreate = body.create_account === true || Boolean(text(body.password));
  const phone = normalizeEmployeeAccountPhone(body.phone);
  if (!shouldCreate) return text(body.user_id);
  if (!phone) throw new Error('创建登录账号需要填写有效手机号');

  const found = await findManagedIdentityByPhone(phone);
  if (found.error) throw found.error;
  let userId = found.identity?.id ?? null;
  if (!userId) {
    const password = text(body.password);
    if (!password || password.length < 8) throw new Error('创建登录账号需要至少 8 位密码');
    const created = await createManagedIdentity({
      phone,
      password,
      displayName: text(body.name) || phone,
    });
    if (created.error || !created.data.user) {
      throw created.error || new Error('创建认证账号失败');
    }
    userId = created.data.user.id;
  }

  await ensureEnterpriseMembership({
    context,
    userId,
    phone,
    name: text(body.name),
  });
  return userId;
}
