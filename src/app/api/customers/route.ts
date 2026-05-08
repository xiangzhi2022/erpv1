import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest, type AuthUser } from '@/lib/auth';

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
      .select('id, name, phone, address, source, tenant_id, created_at, updated_at')
      .order('created_at', { ascending: false });

    // Tenant filtering: scoped to user's tenant if present
    if (user.tenant_id) {
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
    const { name, phone, address, source } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: '客户名称不能为空' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone?.trim() || null;
    const trimmedAddress = address?.trim() || null;
    const trimmedSource = source?.trim() || null;

    const supabase = getSupabaseClient();

    // Deduplication: check if a customer with same name + phone already exists within tenant
    const tenantId = user.tenant_id || null;
    let dupQuery = supabase
      .from('customers')
      .select('id, name, phone, address, source, tenant_id, created_at, updated_at')
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
      // Return existing customer instead of creating a duplicate
      return NextResponse.json({ success: true, data: existing });
    }

    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddress,
        source: trimmedSource,
        tenant_id: tenantId,
      })
      .select('id, name, phone, address, source, tenant_id, created_at, updated_at')
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
