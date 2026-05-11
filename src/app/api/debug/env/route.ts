import { NextResponse } from 'next/server';
import { requireDevEnv } from '../_lib/env-guard';

/**
 * Debug endpoint: shows which environment variables are configured.
 * Only available in development. Never exposes actual values.
 */
export async function GET() {
  const guard = requireDevEnv();
  if (guard) return guard;

  return NextResponse.json({
    hasSupabaseUrl: !!process.env.COZE_SUPABASE_URL,
    hasAnonKey: !!process.env.COZE_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.COZE_SUPABASE_SERVICE_ROLE_KEY,
  });
}
