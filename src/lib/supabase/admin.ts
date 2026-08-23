import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getSupabasePublicCredentials,
  requireEnvironmentVariable,
} from '@/db/client';

export function createAdminClient(): SupabaseClient {
  const { url } = getSupabasePublicCredentials();
  const secretKey = requireEnvironmentVariable('SUPABASE_SECRET_KEY');

  return createClient(url, secretKey, {
    db: { timeout: 60_000 },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
