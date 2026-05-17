import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  ORDER_MODE_CONFIG,
  canCreateOrderInMode,
  normalizeOrderMode,
} from '@/lib/order-flow';

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const mode = normalizeOrderMode(searchParams.get('mode'), user);
    if (!mode) return NextResponse.json({ success: false, error: '无权限访问该订单模块' }, { status: 403 });
    if (!canCreateOrderInMode(user, mode)) {
      return NextResponse.json({ success: false, error: '当前订单模块不允许创建订单' }, { status: 403 });
    }

    const config = ORDER_MODE_CONFIG[mode];
    if (!config.partnerTenantType) {
      return NextResponse.json({ success: true, partners: [] });
    }

    const search = searchParams.get('search')?.trim();
    const supabase = getSupabaseClient();
    let query = supabase
      .from('tenants')
      .select('id, name, company_name, tenant_type, contact_person, contact_phone, address, status')
      .eq('tenant_type', config.partnerTenantType)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (user.tenant_id) query = query.neq('id', user.tenant_id);
    if (search) query = query.or(`name.ilike.%${search}%,company_name.ilike.%${search}%,contact_phone.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      partners: data || [],
      partnerLabel: config.partnerLabel,
      partnerTenantType: config.partnerTenantType,
    });
  } catch (error) {
    console.error('get order partners failed:', error);
    return NextResponse.json({ success: false, error: '获取协作企业失败' }, { status: 500 });
  }
}
