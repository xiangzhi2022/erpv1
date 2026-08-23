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
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasPublishableKey: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
