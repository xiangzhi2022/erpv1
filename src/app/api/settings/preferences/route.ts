import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { authFailed, loadUserSettings, requireSettingsUser, stringifySettingValue } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const preferences = await loadUserSettings(auth.user.id).catch(() => ({}));
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('get preferences failed:', error);
    return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const { key, value } = await request.json();
    if (!key || value === undefined) {
      return NextResponse.json({ success: false, error: '?????' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('user_settings').upsert(
      {
        user_id: auth.user.id,
        setting_key: key,
        setting_value: stringifySettingValue(value),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,setting_key' }
    );

    if (error) {
      return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '???????' });
  } catch (error) {
    console.error('update preferences failed:', error);
    return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
  }
}
