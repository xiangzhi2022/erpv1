import { NextResponse, type NextRequest } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'partners.read');
    const supabase = await createClient();
    const search = request.nextUrl.searchParams.get('search')?.trim();
    let query = supabase
      .from('enterprises')
      .select('id,name,code,enterprise_type,status,created_at,updated_at')
      .eq('enterprise_type', 'manufacturer')
      .eq('status', 'active')
      .neq('id', context.enterpriseId)
      .order('created_at', { ascending: false });
    if (search) {
      const safe = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${safe}%,code.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('factories.list_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '获取工厂列表失败' }, { status: 500 });
    }
    const factories = (data || []).map((enterprise) => ({
      id: enterprise.id,
      name: enterprise.name,
      company_name: enterprise.name,
      type: enterprise.enterprise_type,
      code: enterprise.code,
      status: enterprise.status,
      created_at: enterprise.created_at,
      updated_at: enterprise.updated_at,
      contact_person: null,
      contact_phone: null,
      address: null,
      current_load: null,
      max_load: null,
      is_accepting: true,
      avg_completion_days: null,
      load_percentage: null,
      total_orders: null,
      producing_orders: null,
    }));
    return NextResponse.json({ success: true, data: factories, factories });
  } catch (error) {
    console.error('factories.list_failed', { error });
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
