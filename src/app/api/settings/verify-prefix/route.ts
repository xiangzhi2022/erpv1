import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authFailed, isSettingsAdmin, requireSettingsUser } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const prefix = new URL(request.url).searchParams.get('prefix');
    if (!prefix) return NextResponse.json({ success: false, error: '请输入订单前缀' }, { status: 400 });

    const client = await createClient();
    const { data, error } = await client
      .from('order_prefixes')
      .select('prefix, company_name')
      .eq('enterprise_id', auth.context.enterpriseId)
      .eq('prefix', prefix.toUpperCase())
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, error: '验证订单前缀失败' }, { status: 500 });
    if (data) {
      return NextResponse.json({
        success: true,
        available: false,
        message: `该前缀已由“${data.company_name || '当前企业'}”使用`,
        companyName: data.company_name,
      });
    }

    return NextResponse.json({ success: true, available: true, message: '该前缀可用' });
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

    const { prefix, companyName, phone, address } = await parseJsonObject(request);
    if (typeof prefix !== 'string' || !prefix) return NextResponse.json({ success: false, error: '?????' }, { status: 400 });

    const supabase = await createClient();
    const upperPrefix = prefix.toUpperCase();
    const { data: existing } = await supabase
      .from('order_prefixes')
      .select('id')
      .eq('enterprise_id', auth.context.enterpriseId)
      .eq('prefix', upperPrefix)
      .maybeSingle();

    const payload = {
      company_name: typeof companyName === 'string' ? companyName : null,
      phone: typeof phone === 'string' ? phone : null,
      address: typeof address === 'string' ? address : null,
    };
    const result = existing
      ? await supabase.from('order_prefixes').update(payload).eq('enterprise_id', auth.context.enterpriseId).eq('prefix', upperPrefix)
      : await supabase.from('order_prefixes').insert({
          enterprise_id: auth.context.enterpriseId,
          name: typeof companyName === 'string' && companyName ? companyName : `${upperPrefix} 订单前缀`,
          prefix: upperPrefix,
          ...payload,
        });

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

    const client = await createClient();
    const { error } = await client.from('order_prefixes').delete().eq('enterprise_id', auth.context.enterpriseId).eq('prefix', prefix.toUpperCase());
    if (error) return NextResponse.json({ success: false, error: '????' }, { status: 500 });
    return NextResponse.json({ success: true, message: '??????' });
  } catch (error) {
    console.error('delete prefix failed:', error);
    return NextResponse.json({ success: false, error: '?????' }, { status: 500 });
  }
}
