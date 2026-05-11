import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { authFailed, requireSettingsUser } from '../_utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const { prefix } = await request.json();
    if (!prefix || prefix.length < 1) {
      return NextResponse.json({ success: false, error: '??????' }, { status: 400 });
    }

    const upperPrefix = prefix.toUpperCase();
    const { data, error } = await getSupabaseClient()
      .from('order_prefixes')
      .select('prefix, company_name')
      .eq('prefix', upperPrefix)
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
    if (data) {
      return NextResponse.json({
        success: true,
        available: false,
        message: `?????"${data.company_name || '????'}"??`,
      });
    }

    return NextResponse.json({ success: true, available: true, message: '?????' });
  } catch (error) {
    console.error('check prefix failed:', error);
    return NextResponse.json({ success: false, error: '?????' }, { status: 500 });
  }
}
