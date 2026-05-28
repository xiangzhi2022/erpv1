import { getSupabaseClient } from '@/db/client';
import { hashPassword, type AuthUser } from '@/lib/auth';
import { ensureTenantMembership, text } from '@/lib/employee-management';
import { getUserPermissionKeys, isAdminRole, normalizeAccountRole } from '@/lib/role-access';

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
  password: string;
  real_name?: string | null;
  nickname?: string | null;
}

interface TenantRow {
  id: string;
  tenant_type?: string | null;
  company_name?: string | null;
  name?: string | null;
}

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

async function findUserByPhone(phone: string): Promise<UserRow | null> {
  const { data, error } = await getSupabaseClient()
    .from('users')
    .select('id,phone,password,real_name,nickname')
    .eq('phone', phone)
    .maybeSingle();
  if (error) throw error;
  return data as UserRow | null;
}

async function createUserForInvitation(request: TenantJoinRequestRow, tenant: TenantRow): Promise<UserRow> {
  const passwordHash = hashPassword(request.phone.slice(-6).padStart(6, '0'));
  const { data, error } = await getSupabaseClient()
    .from('users')
    .insert({
      phone: request.phone,
      password: passwordHash,
      real_name: request.name || request.phone,
      nickname: request.name || request.phone,
      role: 'employee',
      department: request.department || null,
      tenant_id: tenant.id,
      tenant_type: tenant.tenant_type || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select('id,phone,password,real_name,nickname')
    .single();
  if (error) throw error;
  return data as UserRow;
}

async function ensureEmployeeProfile(request: TenantJoinRequestRow, member: UserRow) {
  const supabase = getSupabaseClient();
  const { data: existing, error: findError } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', request.tenant_id)
    .eq('user_id', member.id)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return;

  const { error } = await supabase.from('employees').insert({
    user_id: member.id,
    employee_no: request.employee_no || makeEmployeeNo(request.phone),
    name: request.name || member.real_name || member.nickname || request.phone,
    phone: request.phone,
    department_id: null,
    primary_position_id: null,
    employee_type: 'full_time',
    status: 'active',
    tenant_id: request.tenant_id,
    remark: request.request_type === 'employee_apply' ? '员工申请加入后自动创建' : '企业邀请通过后自动创建',
    updated_at: new Date().toISOString(),
  });
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

  let member = request.user_id
    ? ((await supabase.from('users').select('id,phone,password,real_name,nickname').eq('id', request.user_id).single()).data as UserRow | null)
    : await findUserByPhone(request.phone);
  if (!member) member = await createUserForInvitation(request, tenant as TenantRow);

  await ensureTenantMembership({
    tenantId: request.tenant_id,
    userId: member.id,
    phone: request.phone,
    name: request.name || member.real_name || member.nickname || request.phone,
    role: request.role || 'employee',
    department: request.department || null,
    passwordHash: member.password,
  });
  await ensureEmployeeProfile(request, member);

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
