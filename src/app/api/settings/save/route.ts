import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { authFailed, requireSettingsUser, stringifySettingValue } from '../_utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const { prefix, companyName, phone, address } = await request.json();
    if (!prefix) return NextResponse.json({ success: false, error: '??????' }, { status: 400 });

    const settings = [
      ['order_prefix', prefix],
      ['company_name', companyName || ''],
      ['company_phone', phone || ''],
      ['company_address', address || ''],
    ];

    const supabase = getSupabaseClient();
    const rows = settings
      .filter(([, value]) => value)
      .map(([key, value]) => ({
        user_id: auth.user.id,
        setting_key: key,
        setting_value: stringifySettingValue(value),
        updated_at: new Date().toISOString(),
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from('user_settings').upsert(rows, { onConflict: 'user_id,setting_key' });
      if (error) return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '??????' });
  } catch (error) {
    console.error('save settings failed:', error);
    return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
  }
}
