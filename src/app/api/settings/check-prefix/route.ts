import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authFailed, requireSettingsUser } from '../_utils';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const { prefix } = await parseJsonObject(request);
    if (typeof prefix !== 'string' || prefix.length < 1) {
      return NextResponse.json({ success: false, error: '请输入订单前缀' }, { status: 400 });
    }

    const upperPrefix = prefix.toUpperCase();
    const client = await createClient();
    const { data, error } = await client
      .from('order_prefixes')
      .select('prefix, company_name')
      .eq('enterprise_id', auth.context.enterpriseId)
      .eq('prefix', upperPrefix)
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, error: '检查订单前缀失败' }, { status: 500 });
    if (data) {
      return NextResponse.json({
        success: true,
        available: false,
        message: `该前缀已由“${data.company_name || '当前企业'}”使用`,
      });
    }

    return NextResponse.json({ success: true, available: true, message: '该前缀可用' });
  } catch (error) {
    console.error('check prefix failed:', error);
    return NextResponse.json({ success: false, error: '检查订单前缀失败' }, { status: 500 });
  }
}
