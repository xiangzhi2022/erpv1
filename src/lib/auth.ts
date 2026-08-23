/**
 * Compatibility identity facade backed exclusively by Supabase Auth.
 *
 * Enterprise selection and the final permission shape are made authoritative
 * in the enterprise-context module. No credential or session state lives in
 * this process.
 */

import { cookies } from 'next/headers';
import type { JwtPayload } from '@supabase/supabase-js';
import type { PermissionKey } from '@/lib/role-access';
import { createClient } from '@/lib/supabase/server';

export const ACTIVE_TENANT_COOKIE_NAME = 'erp_active_enterprise';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  avatar?: string;
  provider?: 'credentials' | 'github' | 'google';
  role?: string;
  tenant_id?: string;
  tenant_type?: string;
  department?: string;
  nickname?: string;
  permissions?: PermissionKey[];
}

export interface AuthUser extends User {
  role: string;
  tenant_id?: string;
  tenant_name?: string;
  nickname?: string;
  tenant_type?: string;
  department?: string;
  permissions: PermissionKey[];
}

export interface Session {
  user: AuthUser;
  expiresAt: number;
}

interface ActiveMembership {
  id: string;
  tenant_id: string;
  display_name: string;
  enterprise:
    | {
        name: string;
        enterprise_type: string;
        status: string;
      }
    | null;
}

function claimString(claims: JwtPayload, key: string): string | undefined {
  const value = claims[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function profileString(
  profile: { display_name: string | null; phone: string | null; avatar_url: string | null } | null,
  key: 'display_name' | 'phone' | 'avatar_url',
): string | undefined {
  return profile?.[key] || undefined;
}

async function resolveVerifiedUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data: claimData, error: claimError } = await supabase.auth.getClaims();
  const claims = claimData?.claims;
  if (claimError || !claims?.sub) return null;

  const [{ data: profile }, { data: membershipRows }, cookieStore] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name,phone,avatar_url')
      .eq('id', claims.sub)
      .maybeSingle(),
    supabase
      .from('enterprise_memberships')
      .select('id,tenant_id,display_name,enterprise:enterprises(name,enterprise_type,status)')
      .eq('user_id', claims.sub)
      .eq('status', 'active'),
    cookies(),
  ]);

  const memberships = (membershipRows || []).filter(
    (membership) => membership.enterprise?.status === 'active',
  ) as ActiveMembership[];
  const requestedEnterpriseId = cookieStore.get(ACTIVE_TENANT_COOKIE_NAME)?.value;
  const membership = requestedEnterpriseId
    ? memberships.find((entry) => entry.tenant_id === requestedEnterpriseId)
    : memberships.length === 1
      ? memberships[0]
      : undefined;

  let role = 'employee';
  if (membership) {
    const { data: bindings } = await supabase
      .from('role_bindings')
      .select('role:roles(code)')
      .eq('tenant_id', membership.tenant_id)
      .eq('membership_id', membership.id);
    const firstRole = bindings?.[0]?.role;
    if (firstRole && !Array.isArray(firstRole) && typeof firstRole.code === 'string') {
      role = firstRole.code;
    }
  }

  const email = claimString(claims, 'email');
  const phone = profileString(profile, 'phone') || claimString(claims, 'phone');
  const displayName =
    profileString(profile, 'display_name') ||
    membership?.display_name ||
    email ||
    phone ||
    '用户';

  return {
    id: claims.sub,
    email,
    phone,
    name: displayName,
    nickname: displayName,
    avatar: profileString(profile, 'avatar_url'),
    provider: 'credentials',
    role,
    tenant_id: membership?.tenant_id,
    tenant_name: membership?.enterprise?.name,
    tenant_type: membership?.enterprise?.enterprise_type,
    permissions: [],
  };
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  try {
    return await resolveVerifiedUser();
  } catch {
    return null;
  }
}

export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  void request;
  return getCurrentAuthUser();
}

/** @deprecated Use `getCurrentAuthUser()` or the enterprise context directly. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const user = await getCurrentAuthUser();
  if (!user) return null;
  const expiresAt = typeof data.claims.exp === 'number' ? data.claims.exp * 1000 : 0;
  return { user, expiresAt };
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
