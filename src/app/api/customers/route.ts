import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';

const PLATFORM_ROLES = new Set(['super_admin', 'saas_admin']);

// GET /api/customers - Fetch customers for order form selection
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = supabase
      .from('customers')
      .select('id, name, phone, address, source, remark, tenant_id, created_at, updated_at')
      .order('created_at', { ascending: false });

    // customers has no created_by column; non-platform users are scoped by tenant_id.
    if (!PLATFORM_ROLES.has(user.role)) {
      if (!user.tenant_id) {
        return NextResponse.json({ success: false, error: '当前用户未关联租户' }, { status: 403 });
      }
      query = query.eq('tenant_id', user.tenant_id);
    } else if (user.tenant_id) {
      query = query.eq('tenant_id', user.tenant_id);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get customers error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Get customers error:', err);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/customers - Create a new customer (with deduplication)
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, address, source, remark } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: '客户名称不能为空' }, { status: 400 });
    }

    const tenantId = user.tenant_id || null;
    if (!tenantId && !PLATFORM_ROLES.has(user.role)) {
      return NextResponse.json({ success: false, error: '当前用户未关联租户' }, { status: 403 });
    }

    const trimmedName = name.trim();
    const trimmedPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
    const trimmedAddress = typeof address === 'string' && address.trim() ? address.trim() : null;
    const trimmedSource = typeof source === 'string' && source.trim() ? source.trim() : null;
    const trimmedRemark = typeof remark === 'string' && remark.trim() ? remark.trim() : null;

    const supabase = getSupabaseClient();

    let dupQuery = supabase
      .from('customers')
      .select('id, name, phone, address, source, remark, tenant_id, created_at, updated_at')
      .eq('name', trimmedName);

    if (tenantId) {
      dupQuery = dupQuery.eq('tenant_id', tenantId);
    } else {
      dupQuery = dupQuery.is('tenant_id', null);
    }

    if (trimmedPhone) {
      dupQuery = dupQuery.eq('phone', trimmedPhone);
    } else {
      dupQuery = dupQuery.is('phone', null);
    }

    const { data: existing, error: dupError } = await dupQuery.maybeSingle();

    if (dupError) {
      console.error('Customer dedup check error:', dupError);
      return NextResponse.json({ success: false, error: '查重失败' }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ success: true, data: existing });
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddress,
        source: trimmedSource,
        remark: trimmedRemark,
        tenant_id: tenantId,
      })
      .select('id, name, phone, address, source, remark, tenant_id, created_at, updated_at')
      .single();

    if (error) {
      console.error('Create customer error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Create customer error:', err);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
