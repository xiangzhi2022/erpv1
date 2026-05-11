import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    let query = supabase
      .from('tenants')
      .select('id, name, company_name, tenant_type, contact_person, contact_phone, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (user.tenant_id) {
      query = query.neq('id', user.tenant_id);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, partners: data || [] });
  } catch (error) {
    console.error('get order exchange partners failed:', error);
    return NextResponse.json({ success: false, error: '获取协作企业失败' }, { status: 500 });
  }
}
