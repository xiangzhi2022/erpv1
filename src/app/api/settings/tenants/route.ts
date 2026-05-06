import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.COZE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('erp_user');
  if (!token) return null;
  try {
    return JSON.parse(token.value);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tenants: data || [] });
  } catch (error) {
    console.error('获取租户列表失败:', error);
    return NextResponse.json({ success: false, error: '获取租户列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    // 只有官方管理员可以创建租户
    if (user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: '只有管理员可以创建租户' }, { status: 403 });
    }

    const body = await request.json();
    const { tenant_type, company_name, contact_phone, address, prefix } = body;

    if (!tenant_type || !company_name) {
      return NextResponse.json({ success: false, error: '租户类型和公司名称必填' }, { status: 400 });
    }

    if (!['manufacturer', 'dealer', 'material_supplier'].includes(tenant_type)) {
      return NextResponse.json({ success: false, error: '无效的租户类型' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 如果提供了前缀，检查是否已存在
    if (prefix) {
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('prefix', prefix)
        .single();
      
      if (existing) {
        return NextResponse.json({ success: false, error: '该前缀已被使用' }, { status: 400 });
      }
    }

    // 创建租户
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        tenant_type,
        company_name,
        contact_phone: contact_phone || null,
        address: address || null,
        prefix: prefix || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tenant: data });
  } catch (error) {
    console.error('创建租户失败:', error);
    return NextResponse.json({ success: false, error: '创建租户失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    if (user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: '只有管理员可以修改租户' }, { status: 403 });
    }

    const body = await request.json();
    const { id, company_name, contact_phone, address, prefix, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '租户ID必填' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 如果更新前缀，检查是否与其他租户冲突
    if (prefix) {
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('prefix', prefix)
        .neq('id', id)
        .single();
      
      if (existing) {
        return NextResponse.json({ success: false, error: '该前缀已被其他租户使用' }, { status: 400 });
      }
    }

    const updateData: Record<string, string> = {};
    if (company_name) updateData.company_name = company_name;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone;
    if (address !== undefined) updateData.address = address;
    if (prefix !== undefined) updateData.prefix = prefix;
    if (status) updateData.status = status;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tenant: data });
  } catch (error) {
    console.error('更新租户失败:', error);
    return NextResponse.json({ success: false, error: '更新租户失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    if (user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: '只有管理员可以删除租户' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '租户ID必填' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 不允许删除官方管理员
    const { data: tenant } = await supabase
      .from('tenants')
      .select('tenant_type')
      .eq('id', id)
      .single();

    if (tenant?.tenant_type === 'official') {
      return NextResponse.json({ success: false, error: '不能删除官方租户' }, { status: 400 });
    }

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除租户失败:', error);
    return NextResponse.json({ success: false, error: '删除租户失败' }, { status: 500 });
  }
}
