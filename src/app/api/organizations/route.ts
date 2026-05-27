import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { ACTIVE_TENANT_COOKIE_NAME, getUserFromRequest, isProduction } from '@/lib/auth';
import { getLandingPath, normalizeAccountRole, type AccessUser, type PermissionKey } from '@/lib/role-access';

interface TenantRow {
  id: string;
  name?: string | null;
  company_name?: string | null;
  tenant_type?: string | null;
  status?: string | null;
}

interface MembershipRow {
  tenant_id: string;
  role?: string | null;
  department?: string | null;
  name?: string | null;
  status?: string | null;
  tenant?: TenantRow | TenantRow[] | null;
}

interface PermissionRow {
  permission_key?: string | null;
}

interface OrganizationIdentity {
  tenant_id: string;
  tenant_name: string;
  tenant_type: string;
  tenant_status: string;
  role: string;
  department: string;
  member_name: string;
  status: string;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function firstTenant(value: MembershipRow['tenant']): TenantRow | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function normalizeMembership(row: MembershipRow): OrganizationIdentity {
  const tenant = firstTenant(row.tenant);
  return {
    tenant_id: row.tenant_id,
    tenant_name: tenant?.company_name || tenant?.name || '未命名企业',
    tenant_type: tenant?.tenant_type || '',
    tenant_status: tenant?.status || 'active',
    role: String(normalizeAccountRole(row.role || 'employee') === 'guest'
      ? 'employee'
      : normalizeAccountRole(row.role || 'employee')),
    department: row.department || '',
    member_name: row.name || '',
    status: row.status || 'active',
  };
}

async function loadTenantPermissions(userId: string, tenantId: string): Promise<PermissionKey[]> {
  const { data } = await getSupabaseClient()
    .from('user_permissions')
    .select('permission_key')
    .eq('user_id', userId)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
  return Array.from(
    new Set(
      ((data || []) as PermissionRow[])
        .map((row) => row.permission_key)
        .filter((key): key is PermissionKey => Boolean(key)),
    ),
  );
}

async function findMembership(userId: string, tenantId: string) {
  const { data, error } = await getSupabaseClient()
    .from('tenant_users')
    .select('tenant_id, role, department, name, status, tenant:tenants(id,name,company_name,tenant_type,status)')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeMembership(data as MembershipRow) : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);

    const supabase = getSupabaseClient();
    const { data: memberships, error } = await supabase
      .from('tenant_users')
      .select('tenant_id, role, department, name, status, tenant:tenants(id,name,company_name,tenant_type,status)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    if (error) return jsonError(error.message, 500);

    const rows = ((memberships || []) as MembershipRow[]).map(normalizeMembership);
    if (user.tenant_id && !rows.some((row) => row.tenant_id === user.tenant_id)) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id,name,company_name,tenant_type,status')
        .eq('id', user.tenant_id)
        .maybeSingle();
      rows.unshift({
        tenant_id: user.tenant_id,
        tenant_name: tenant?.company_name || tenant?.name || user.tenant_name || '当前企业',
        tenant_type: tenant?.tenant_type || user.tenant_type || '',
        tenant_status: tenant?.status || 'active',
        role: user.role,
        department: user.department || '',
        member_name: user.nickname || user.name || '',
        status: 'active',
      });
    }

    return NextResponse.json({
      success: true,
      active_tenant_id: user.tenant_id || null,
      organizations: rows,
    });
  } catch (error) {
    console.error('get organizations failed:', error);
    return jsonError('获取组织身份失败', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    const body = (await request.json()) as { tenant_id?: string };
    const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : '';
    if (!tenantId) return jsonError('请选择要切换的组织', 400);

    let membership = await findMembership(user.id, tenantId);
    if (!membership && user.tenant_id === tenantId) {
      membership = {
        tenant_id: tenantId,
        tenant_name: user.tenant_name || '当前企业',
        tenant_type: user.tenant_type || '',
        tenant_status: 'active',
        role: user.role,
        department: user.department || '',
        member_name: user.nickname || user.name || '',
        status: 'active',
      };
    }
    if (!membership) return jsonError('你没有该组织的有效身份', 403);

    const permissions = await loadTenantPermissions(user.id, tenantId);
    const redirectTo = getLandingPath({
      role: membership.role,
      tenant_id: tenantId,
      tenant_type: membership.tenant_type,
      permissions,
    } satisfies AccessUser);

    const response = NextResponse.json({
      success: true,
      active_tenant_id: tenantId,
      organization: membership,
      redirectTo,
    });
    response.cookies.set(ACTIVE_TENANT_COOKIE_NAME, tenantId, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction(),
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    console.error('switch organization failed:', error);
    return jsonError('切换组织失败', 500);
  }
}
