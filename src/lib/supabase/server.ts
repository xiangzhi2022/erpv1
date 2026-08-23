import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/db/database.types';
import { getSupabasePublicCredentials } from '@/db/client';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicCredentials();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The request Proxy performs
          // refresh writes before rendering, so reads remain safe here.
        }
      },
    },
  });
}
