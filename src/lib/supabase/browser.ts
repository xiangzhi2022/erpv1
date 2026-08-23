'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/db/database.types';
import { getSupabasePublicCredentials } from '@/db/client';

export function createClient() {
  const { url, publishableKey } = getSupabasePublicCredentials();
  return createBrowserClient<Database>(url, publishableKey);
}
