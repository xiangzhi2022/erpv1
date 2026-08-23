import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authFailed, requireSettingsUser, stringifySettingValue } from '../_utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const { prefix, companyName, phone, address } = await parseJsonObject(request);
    if (!prefix) return NextResponse.json({ success: false, error: '??????' }, { status: 400 });

    const settings: Array<[string, unknown]> = [
      ['order_prefix', prefix],
      ['company_name', companyName || ''],
      ['company_phone', phone || ''],
      ['company_address', address || ''],
    ];

    const supabase = await createClient();
    const rows = settings
      .filter(([, value]) => value)
      .map(([key, value]) => ({
        enterprise_id: auth.context.enterpriseId,
        user_id: auth.user.id,
        key,
        value: stringifySettingValue(value),
        updated_at: new Date().toISOString(),
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from('user_settings').upsert(rows, { onConflict: 'enterprise_id,user_id,key' });
      if (error) return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '??????' });
  } catch (error) {
    console.error('save settings failed:', error);
    return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
  }
}
