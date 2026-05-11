import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest, type AuthUser } from '@/lib/auth';
import { isAdminRole } from '@/lib/role-access';

export type SettingsAuthResult = { user: AuthUser } | { response: NextResponse };

export async function requireSettingsUser(request: Request): Promise<SettingsAuthResult> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { response: NextResponse.json({ success: false, error: '????' }, { status: 401 }) };
  }
  return { user };
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

export function settingsRowsToObject(rows: Array<{ setting_key: string; setting_value: string | null }> | null | undefined) {
  const settings: Record<string, string> = {};
  for (const row of rows || []) {
    settings[row.setting_key] = row.setting_value ?? '';
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

export async function loadUserSettings(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_settings')
    .select('setting_key, setting_value')
    .eq('user_id', userId);

  if (error) throw error;
  return settingsRowsToObject(data);
}
