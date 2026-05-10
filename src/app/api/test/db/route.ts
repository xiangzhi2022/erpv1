import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { requireDevEnv, safeErrorMessage } from '../../debug/_lib/env-guard';

/**
 * Test endpoint: verifies database connectivity only.
 * Only available in development. Performs a minimal read query
 * without exposing any user data.
 */
export async function GET() {
  const guard = requireDevEnv();
  if (guard) return guard;

  try {
    const supabase = getSupabaseClient();

    // Minimal connectivity check — select only the count, no user data
    const { error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: 'Database query failed',
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: safeErrorMessage(err),
    });
  }
}
