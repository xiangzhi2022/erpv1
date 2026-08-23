import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/db/database.types';
import { getSupabasePublicCredentials } from '@/db/client';

type VerifiedClaims = Record<string, unknown> & { sub?: string };

export interface SessionUpdateResult {
  response: NextResponse;
  claims: VerifiedClaims | null;
}

export async function updateSession(request: NextRequest): Promise<SessionUpdateResult> {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicCredentials();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, requiredHeaders) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        const nextResponse = NextResponse.next({ request });
        for (const [name, value] of response.headers) {
          nextResponse.headers.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          nextResponse.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(requiredHeaders)) {
          nextResponse.headers.set(name, value);
        }
        response = nextResponse;
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return {
    response,
    claims: (data?.claims as VerifiedClaims | undefined) ?? null,
  };
}
