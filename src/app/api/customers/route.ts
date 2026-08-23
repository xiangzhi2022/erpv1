import { parseJsonObject } from '@/lib/api/request';
﻿import { NextResponse } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

// GET /api/customers - Fetch customers for order form selection
export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'customers.read');
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = supabase
      .from('customers')
      .select('id, name, phone, address, source, status, enterprise_id, created_at, updated_at')
      .eq('enterprise_id', context.enterpriseId)
      .order('created_at', { ascending: false });

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get customers error:', error);
      return NextResponse.json({ success: false, error: '查询客户失败' }, { status: 500 });
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
    const context = await getEnterpriseContext();
    requirePermission(context, 'customers.manage');

    const body = await parseJsonObject(request);
    const { name, phone, address, source } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: '客户名称不能为空' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
    const trimmedAddress = typeof address === 'string' && address.trim() ? address.trim() : null;
    const trimmedSource = typeof source === 'string' && source.trim() ? source.trim() : null;
    const supabase = await createClient();

    let dupQuery = supabase
      .from('customers')
      .select('id, name, phone, address, source, status, enterprise_id, created_at, updated_at')
      .eq('enterprise_id', context.enterpriseId)
      .eq('name', trimmedName);

    if (trimmedPhone) {
      dupQuery = dupQuery.eq('phone', trimmedPhone);
    } else {
      dupQuery = dupQuery.is('phone', null);
    }

    const { data: existing, error: dupError } = await dupQuery.maybeSingle();

    if (dupError) {
      console.error('Customer dedup check error:', dupError);
      return NextResponse.json({ success: false, error: '客户查重失败' }, { status: 500 });
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
        enterprise_id: context.enterpriseId,
      })
      .select('id, name, phone, address, source, status, enterprise_id, created_at, updated_at')
      .single();

    if (error) {
      console.error('Create customer error:', error);
      return NextResponse.json({ success: false, error: '创建客户失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Create customer error:', err);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
