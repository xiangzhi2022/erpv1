import type { EnterpriseContext } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

export interface EmployeeRoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  tenant_id: string;
}

export class EmployeeIdentityConflict extends Error {
  readonly status = 409;
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
  if (roleIdsOrCodes.some((value) => !isUuid(value))) {
    throw new EmployeeIdentityConflict('角色 ID 不正确');
  }
  const query = client
    .from('roles')
    .select('id,code,name,description,tenant_id')
    .eq('tenant_id', context.enterpriseId)
    .in('id', roleIdsOrCodes);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length !== roleIdsOrCodes.length) {
    throw new Error('包含无效或无权分配的角色');
  }
  return rows;
}

export async function syncEmployeeRoleBindings(
  userId: string | null,
  roles: EmployeeRoleRow[],
  context: EnterpriseContext,
): Promise<void> {
  if (!userId) return;
  const client = await createClient();
  const { error } = await client.rpc('replace_employee_role_bindings', {
    target_enterprise_id: context.enterpriseId,
    target_role_ids: roles.map((role) => role.id),
    target_user_id: userId,
  });
  if (error) throw error;
}

export async function createOrReuseEmployeeLoginUser(
  body: Record<string, unknown>,
  context: EnterpriseContext,
): Promise<string | null> {
  const shouldCreate = body.create_account === true || Boolean(text(body.password));
  if (shouldCreate) {
    throw new EmployeeIdentityConflict('不能由管理员创建或复用登录账号；请让用户注册并提交加入申请。');
  }
  const userId = text(body.user_id);
  if (!userId) return null;
  if (!isUuid(userId)) throw new EmployeeIdentityConflict('登录账号 ID 不正确');
  const client = await createClient();
  const { data: membership, error } = await client
    .from('enterprise_memberships')
    .select('id,status')
    .eq('tenant_id', context.enterpriseId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  if (!membership) {
    throw new EmployeeIdentityConflict('该账号尚未通过当前企业的加入审批');
  }
  return userId;
}
