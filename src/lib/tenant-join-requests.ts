import { getSupabaseClient } from '@/db/client';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { AuthUser } from '@/lib/auth';
import { ensureTenantMembership, text } from '@/lib/employee-management';
import { getUserPermissionKeys, isAdminRole, normalizeAccountRole } from '@/lib/role-access';
import { createAdminClient } from '@/lib/supabase/admin';

export type TenantJoinRequestType = 'employee_apply' | 'org_invite';
export type TenantJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'canceled';

export interface TenantJoinRequestRow {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  phone: string;
  name?: string | null;
  request_type: TenantJoinRequestType;
  status: TenantJoinRequestStatus;
  role?: string | null;
  department?: string | null;
  employee_no?: string | null;
  message?: string | null;
  requested_by?: string | null;
  handled_by?: string | null;
  handled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  tenant?: { id?: string; company_name?: string | null; name?: string | null; tenant_type?: string | null } | null;
  user?: { id?: string; phone?: string | null; real_name?: string | null; nickname?: string | null } | null;
}

interface UserRow {
  id: string;
  phone: string;
  real_name?: string | null;
  nickname?: string | null;
  role?: string | null;
  tenant_id?: string | null;
  tenant_type?: string | null;
  department?: string | null;
}

interface TenantRow {
  id: string;
  tenant_type?: string | null;
  company_name?: string | null;
  name?: string | null;
}

interface ExistingEmployeeProfile {
  id: string;
  user_id?: string | null;
}

interface EmployeeProfileWriteInput {
  existingByUserId: ExistingEmployeeProfile | null;
  existingByPhone: ExistingEmployeeProfile | null;
  memberUserId: string;
  tenantId: string;
  phone: string;
  name: string;
  employeeNo: string;
  requestType: TenantJoinRequestType;
}

export type EmployeeProfileWrite =
  | { action: 'none'; id: string }
  | { action: 'update'; id: string; values: Record<string, string | null> }
  | { action: 'insert'; values: Record<string, string | null> };

export function canManageTenantMembers(user: AuthUser): boolean {
  return isAdminRole(user) || getUserPermissionKeys(user).includes('factory_boss');
}

export function normalizePhone(value: unknown): string | null {
  const phone = text(value)?.replace(/\D/g, '') || null;
  return phone && /^1[3-9]\d{9}$/.test(phone) ? phone : null;
}

export function normalizeMemberRole(value: unknown): string {
  const role = typeof value === 'string' ? normalizeAccountRole(value) : 'employee';
  return role === 'guest' ? 'employee' : role;
}

export function makeEmployeeNo(phone: string): string {
  const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `E${today}${phone.slice(-4)}`;
}

export function buildExistingUserTenantPatch(input: {
  existingTenantId?: string | null;
  existingTenantType?: string | null;
  tenantId: string;
  tenantType?: string | null;
  role?: string | null;
  department?: string | null;
}): Record<string, string | null> {
  if (input.existingTenantId) return {};
  return {
    tenant_id: input.tenantId,
    tenant_type: input.tenantType || input.existingTenantType || null,
    role: normalizeMemberRole(input.role),
    department: input.department || null,
  };
}

export function chooseEmployeeProfileWrite(input: EmployeeProfileWriteInput): EmployeeProfileWrite {
  if (input.existingByUserId?.id) return { action: 'none', id: input.existingByUserId.id };

  const values = {
    user_id: input.memberUserId,
    employee_no: input.employeeNo,
    name: input.name,
    phone: input.phone,
    department_id: null,
    primary_position_id: null,
    employee_type: 'full_time',
    status: 'active',
    tenant_id: input.tenantId,
    remark: input.requestType === 'employee_apply'
      ? 'Created after employee join request approval'
      : 'Created after organization invitation approval',
    updated_at: new Date().toISOString(),
  };

  if (input.existingByPhone?.id) {
    return { action: 'update', id: input.existingByPhone.id, values };
  }
  return { action: 'insert', values };
}

async function findUserByPhone(phone: string): Promise<UserRow | null> {
  const { data, error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const identity = data.users.find((user) => user.phone === phone);
  return identity ? authIdentityToUserRow(identity, phone) : null;
}

async function createUserForInvitation(request: TenantJoinRequestRow, tenant: TenantRow): Promise<UserRow> {
  const { data, error } = await createAdminClient().auth.admin.createUser({
    phone: request.phone,
    phone_confirm: false,
    user_metadata: { display_name: request.name || request.phone },
  });
  if (error || !data.user) throw error || new Error('创建邀请身份失败');
  return {
    ...authIdentityToUserRow(data.user, request.phone),
    tenant_id: tenant.id,
    tenant_type: tenant.tenant_type || null,
    department: request.department || null,
  };
}

function authIdentityToUserRow(identity: SupabaseAuthUser, phoneFallback: string): UserRow {
  const displayName = typeof identity.user_metadata.display_name === 'string'
    ? identity.user_metadata.display_name
    : null;
  return {
    id: identity.id,
    phone: identity.phone || phoneFallback,
    real_name: displayName,
    nickname: displayName,
    role: 'employee',
  };
}

async function ensureEmployeeProfileForMembership(request: TenantJoinRequestRow, member: UserRow) {
  const supabase = getSupabaseClient();
  const { data: existingByUserId, error: findByUserError } = await supabase
    .from('employees')
    .select('id,user_id')
    .eq('tenant_id', request.tenant_id)
    .eq('user_id', member.id)
    .maybeSingle();
  if (findByUserError) throw findByUserError;

  const { data: existingByPhone, error: findByPhoneError } = await supabase
    .from('employees')
    .select('id,user_id')
    .eq('tenant_id', request.tenant_id)
    .eq('phone', request.phone)
    .maybeSingle();
  if (findByPhoneError) throw findByPhoneError;

  const write = chooseEmployeeProfileWrite({
    existingByUserId: existingByUserId as ExistingEmployeeProfile | null,
    existingByPhone: existingByPhone as ExistingEmployeeProfile | null,
    memberUserId: member.id,
    tenantId: request.tenant_id,
    phone: request.phone,
    name: request.name || member.real_name || member.nickname || request.phone,
    employeeNo: request.employee_no || makeEmployeeNo(request.phone),
    requestType: request.request_type,
  });

  if (write.action === 'none') return;
  const mutation = write.action === 'update'
    ? supabase.from('employees').update(write.values).eq('id', write.id)
    : supabase.from('employees').insert(write.values);
  const { error } = await mutation;
  if (error) throw error;
}

export async function approveJoinRequest(request: TenantJoinRequestRow, actor: AuthUser) {
  const supabase = getSupabaseClient();
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id,tenant_type,company_name,name')
    .eq('id', request.tenant_id)
    .single();
  if (tenantError) throw tenantError;

  let member: UserRow | null;
  if (request.user_id) {
    const { data, error } = await createAdminClient().auth.admin.getUserById(request.user_id);
    if (error) throw error;
    member = data.user ? authIdentityToUserRow(data.user, request.phone) : null;
  } else {
    member = await findUserByPhone(request.phone);
  }
  if (!member) member = await createUserForInvitation(request, tenant as TenantRow);

  await ensureTenantMembership({
    tenantId: request.tenant_id,
    userId: member.id,
    phone: request.phone,
    name: request.name || member.real_name || member.nickname || request.phone,
    role: request.role || 'employee',
    department: request.department || null,
  });
  await ensureEmployeeProfileForMembership(request, member);

  const { error } = await supabase
    .from('tenant_join_requests')
    .update({
      status: 'approved',
      handled_by: actor.id,
      handled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: member.id,
    })
    .eq('id', request.id);
  if (error) throw error;
}
