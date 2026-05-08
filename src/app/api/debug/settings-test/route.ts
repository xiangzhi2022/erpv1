import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { requireDevEnv, safeErrorMessage } from '../_lib/env-guard';

/**
 * Debug endpoint: tests user_settings table connectivity and write operations.
 * Only available in development. Never exposes stack traces or internal details.
 */
export async function POST(request: NextRequest) {
  const guard = requireDevEnv();
  if (guard) return guard;

  try {
    const supabase = getSupabaseClient();

    // Verify the user is authenticated
    const userCookie = request.cookies.get('erp_user');
    if (!userCookie) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 },
      );
    }

    const user = JSON.parse(userCookie.value);

    // 1. Check user_settings table exists (read-only connectivity check)
    const { error: tablesError } = await supabase
      .from('user_settings')
      .select('id')
      .limit(1);

    if (tablesError) {
      return NextResponse.json({
        success: false,
        error: 'Table check failed',
        tableExists: false,
      });
    }

    // 2. Attempt insert (only in dev)
    const { data, error: insertError } = await supabase
      .from('user_settings')
      .insert({
        user_id: user.id,
        setting_key: 'order_prefix',
        setting_value: 'TEST',
        updated_at: new Date().toISOString(),
      })
      .select('id, user_id, setting_key, setting_value, updated_at')
      .single();

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: 'Insert failed',
        tableExists: true,
      });
    }

    return NextResponse.json({
      success: true,
      tableExists: true,
      insertOk: true,
      insertedId: data.id,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: safeErrorMessage(err) },
      { status: 500 },
    );
  }
}
