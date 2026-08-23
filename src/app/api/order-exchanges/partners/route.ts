import { NextResponse } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'partners.read');
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('enterprises')
      .select('id,name,code,enterprise_type,status')
      .eq('status', 'active')
      .neq('id', context.enterpriseId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('exchange_partners.list_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '获取协作企业失败' }, { status: 500 });
    }
    const partners = (data || []).map((enterprise) => ({
      id: enterprise.id,
      name: enterprise.name,
      company_name: enterprise.name,
      code: enterprise.code,
      tenant_type: enterprise.enterprise_type,
      status: enterprise.status,
      contact_person: null,
      contact_phone: null,
    }));
    return NextResponse.json({ success: true, partners });
  } catch (error) {
    console.error('exchange_partners.list_failed', { error });
    return NextResponse.json({ success: false, error: '获取协作企业失败' }, { status: 500 });
  }
}
