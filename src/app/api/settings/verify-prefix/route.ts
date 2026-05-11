import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { authFailed, isSettingsAdmin, requireSettingsUser } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const prefix = new URL(request.url).searchParams.get('prefix');
    if (!prefix) return NextResponse.json({ success: false, error: '?????????' }, { status: 400 });

    const { data, error } = await getSupabaseClient()
      .from('order_prefixes')
      .select('prefix, company_name')
      .eq('prefix', prefix.toUpperCase())
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, error: '????' }, { status: 500 });
    if (data) {
      return NextResponse.json({
        success: true,
        available: false,
        message: `?????"${data.company_name || '????'}"??`,
        companyName: data.company_name,
      });
    }

    return NextResponse.json({ success: true, available: true, message: '?????' });
  } catch (error) {
    console.error('verify prefix failed:', error);
    return NextResponse.json({ success: false, error: '?????' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!isSettingsAdmin(auth.user)) {
      return NextResponse.json({ success: false, error: '?????????????' }, { status: 403 });
    }

    const { prefix, companyName, phone, address } = await request.json();
    if (!prefix) return NextResponse.json({ success: false, error: '?????' }, { status: 400 });

    const supabase = getSupabaseClient();
    const upperPrefix = prefix.toUpperCase();
    const { data: existing } = await supabase
      .from('order_prefixes')
      .select('id')
      .eq('prefix', upperPrefix)
      .maybeSingle();

    const payload = { company_name: companyName || null, phone: phone || null, address: address || null };
    const result = existing
      ? await supabase.from('order_prefixes').update(payload).eq('prefix', upperPrefix)
      : await supabase.from('order_prefixes').insert({ prefix: upperPrefix, ...payload });

    if (result.error) return NextResponse.json({ success: false, error: '????' }, { status: 500 });
    return NextResponse.json({ success: true, message: '??????' });
  } catch (error) {
    console.error('save prefix failed:', error);
    return NextResponse.json({ success: false, error: '?????' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!isSettingsAdmin(auth.user)) {
      return NextResponse.json({ success: false, error: '?????????????' }, { status: 403 });
    }

    const prefix = new URL(request.url).searchParams.get('prefix');
    if (!prefix) return NextResponse.json({ success: false, error: '?????????' }, { status: 400 });

    const { error } = await getSupabaseClient().from('order_prefixes').delete().eq('prefix', prefix.toUpperCase());
    if (error) return NextResponse.json({ success: false, error: '????' }, { status: 500 });
    return NextResponse.json({ success: true, message: '??????' });
  } catch (error) {
    console.error('delete prefix failed:', error);
    return NextResponse.json({ success: false, error: '?????' }, { status: 500 });
  }
}
