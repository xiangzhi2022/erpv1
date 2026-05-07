import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.COZE_SUPABASE_URL || 'https://cdcnjtgabgjkouavwxsl.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

async function getAuthUser() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get('erp_user');
  if (!token) return null;
  try {
    return JSON.parse(token.value);
  } catch {
    return null;
  }
}

// PATCH - 更新供应商信息（支持全量编辑和快捷状态切换）
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, contactPerson, phone, email, category, rating, status, address, remark } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少供应商ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 如果更新名称，检查是否重复
    if (name) {
      const { data: existing } = await supabase
        .from('suppliers')
        .select('id')
        .eq('name', name)
        .neq('id', id)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json({ success: false, error: '供应商名称已存在' }, { status: 400 });
      }
    }

    // 构建更新对象（只包含传入的字段）
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (contactPerson !== undefined) updateData.contact_person = contactPerson;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (category !== undefined) updateData.category = category;
    if (rating !== undefined) updateData.rating = rating;
    if (status !== undefined) updateData.status = status;
    if (address !== undefined) updateData.address = address;
    if (remark !== undefined) updateData.remark = remark;

    const { data, error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('更新供应商失败:', error);
    return NextResponse.json({ success: false, error: '更新供应商失败' }, { status: 500 });
  }
}
