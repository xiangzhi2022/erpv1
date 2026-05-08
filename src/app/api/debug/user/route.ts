import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { requireDevEnv, safeErrorMessage } from '../_lib/env-guard';

/**
 * Debug endpoint: looks up a user by phone for development testing.
 * Only available in development. Never exposes password or stack traces.
 */
export async function GET() {
  const guard = requireDevEnv();
  if (guard) return guard;

  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, phone, nickname, role')
      .eq('phone', '13506872751')
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Query failed',
      });
    }

    return NextResponse.json({
      success: true,
      user: data,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: safeErrorMessage(err),
    });
  }
}
