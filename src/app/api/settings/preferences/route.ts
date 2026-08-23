import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authFailed, loadUserSettings, requireSettingsUser, stringifySettingValue } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const preferences = await loadUserSettings(auth.user.id, auth.context.enterpriseId).catch(() => ({}));
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

    const { key, value } = await parseJsonObject(request);
    if (!key || value === undefined) {
      return NextResponse.json({ success: false, error: '?????' }, { status: 400 });
    }

    if (typeof key !== 'string' || !key.trim()) {
      return NextResponse.json({ success: false, error: '设置项名称无效' }, { status: 400 });
    }
    const supabase = await createClient();
    const { error } = await supabase.from('user_settings').upsert(
      {
        enterprise_id: auth.context.enterpriseId,
        user_id: auth.user.id,
        key,
        value: stringifySettingValue(value),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'enterprise_id,user_id,key' }
    );

    if (error) {
      return NextResponse.json({ success: false, error: '更新偏好设置失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '偏好设置已更新' });
  } catch (error) {
    console.error('update preferences failed:', error);
    return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
  }
}
