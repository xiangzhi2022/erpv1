import 'server-only';
import { getSupabaseCredentials } from '@/db/client';

export function getFactoryWorkshopAdminHeaders(
  options?: { prefer?: string },
): Record<string, string> {
  const { secretKey } = getSupabaseCredentials();
  if (!secretKey) throw new Error('Supabase admin credential is unavailable');
  return {
    'Content-Type': 'application/json',
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    Prefer: options?.prefer ?? 'return=representation',
  };
}

export function getFactoryWorkshopAdminUrl(): string {
  const { url } = getSupabaseCredentials();
  return `${url}/rest/v1`;
}
