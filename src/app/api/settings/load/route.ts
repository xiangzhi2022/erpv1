import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { authFailed, isSettingsAdmin, loadUserSettings, requireSettingsUser } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const supabase = getSupabaseClient();
    const settings: Record<string, string> = await loadUserSettings(auth.user.id).catch(() => ({}));
    const isAdmin = isSettingsAdmin(auth.user);

    let prefixes: Array<{ prefix: string; company_name: string | null; phone: string | null; address: string | null }> = [];
    if (isAdmin) {
      const { data, error } = await supabase
        .from('order_prefixes')
        .select('prefix, company_name, phone, address')
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('load order prefixes failed:', error);
      } else {
        prefixes = data || [];
        if (!settings.order_prefix && prefixes[0]?.prefix) settings.order_prefix = prefixes[0].prefix;
        if (!settings.company_name && prefixes[0]?.company_name) settings.company_name = prefixes[0].company_name;
      }
    }

    return NextResponse.json({ success: true, settings, prefixes, isAdmin });
  } catch (error) {
    console.error('load settings failed:', error);
    return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
  }
}
