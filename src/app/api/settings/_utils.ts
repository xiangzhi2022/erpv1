import { NextResponse } from 'next/server';
import { getCurrentAuthUser, type AuthUser } from '@/lib/auth';
import { getEnterpriseContext, type EnterpriseContext } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/role-access';

export type SettingsAuthResult = { user: AuthUser; context: EnterpriseContext } | { response: NextResponse };

export async function requireSettingsUser(request: Request): Promise<SettingsAuthResult> {
  void request;
  const [user, context] = await Promise.all([getCurrentAuthUser(), getEnterpriseContext()]);
  if (!user) {
    return { response: NextResponse.json({ success: false, error: '请先登录' }, { status: 401 }) };
  }
  return { user, context };
}

export function authFailed(result: SettingsAuthResult): result is { response: NextResponse } {
  return 'response' in result;
}

export function isSettingsAdmin(user: Pick<AuthUser, 'role'>): boolean {
  return isAdminRole(user);
}

export function stringifySettingValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? '');
}

export function settingsRowsToObject(rows: Array<{ key: string; value: unknown }> | null | undefined) {
  const settings: Record<string, string> = {};
  for (const row of rows || []) {
    settings[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value ?? '');
  }
  return settings;
}

export function appTenantTypeToRemote(value: string | null | undefined): string | null {
  return value || null;
}

export function remoteTenantTypeToApp(value: string | null | undefined): string {
  const map: Record<string, string> = {
    producer: 'manufacturer',
    distributor: 'dealer',
    supplier: 'material_supplier',
  };
  return value ? map[value] || value : '';
}

export function normalizeTenant<T extends {
  id: string;
  name?: string | null;
  tenant_type?: string | null;
  type?: string | null;
  company_name?: string | null;
  prefix?: string | null;
  order_prefix?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}>(tenant: T) {
  return {
    ...tenant,
    tenant_type: remoteTenantTypeToApp(tenant.tenant_type || tenant.type),
    company_name: tenant.company_name || tenant.name || '',
    prefix: tenant.prefix || tenant.order_prefix || '',
  };
}

export async function loadUserSettings(userId: string, enterpriseId?: string) {
  const context = enterpriseId ? null : await getEnterpriseContext();
  const client = await createClient();
  const { data, error } = await client
    .from('user_settings')
    .select('key, value')
    .eq('enterprise_id', enterpriseId ?? context!.enterpriseId)
    .eq('user_id', userId);

  if (error) throw error;
  return settingsRowsToObject(data);
}
