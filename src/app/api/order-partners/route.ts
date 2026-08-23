import { NextResponse, type NextRequest } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.create');
    const mode = request.nextUrl.searchParams.get('mode');
    const targetType = mode === 'dealer' && context.enterpriseType === 'dealer'
      ? 'manufacturer'
      : mode === 'factory_material' && context.enterpriseType === 'manufacturer'
        ? 'supplier'
        : null;
    if (!targetType) {
      return NextResponse.json({ success: false, error: '当前订单模块不允许创建订单' }, { status: 403 });
    }

    const search = request.nextUrl.searchParams.get('search')?.trim();
    const supabase = await createClient();
    let query = supabase
      .from('enterprises')
      .select('id,name,code,enterprise_type,status')
      .eq('enterprise_type', targetType)
      .eq('status', 'active')
      .neq('id', context.enterpriseId)
      .order('created_at', { ascending: false });
    if (search) {
      const safe = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${safe}%,code.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    if (error) {
      console.error('order_partners.list_failed', { code: error.code });
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
      address: null,
    }));
    return NextResponse.json({
      success: true,
      partners,
      partnerLabel: targetType === 'manufacturer' ? '工厂企业' : '材料商',
      partnerTenantType: targetType,
    });
  } catch (error) {
    console.error('order_partners.list_failed', { error });
    return NextResponse.json({ success: false, error: '获取协作企业失败' }, { status: 500 });
  }
}
