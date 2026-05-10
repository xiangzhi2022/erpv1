import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.COZE_SUPABASE_URL!;
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
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

const VALID_STATUSES = ['active', 'inspecting', 'blacklisted'] as const;
const VALID_RATINGS = ['A', 'B', 'C', 'D'] as const;
const VALID_CATEGORIES = ['原材料', '包装耗材', '外协加工', '办公设备'] as const;

// 将空字符串转为 null，确保数据库写入一致性
function toNullIfEmpty(value: string | undefined | null): string | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  return value.trim();
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

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: '缺少供应商ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 先验证供应商存在
    const { data: existing, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: '供应商不存在' }, { status: 404 });
    }

    // 如果更新名称，检查是否重复
    if (name !== undefined && name !== null) {
      const trimmedName = String(name).trim();
      if (trimmedName === '') {
        return NextResponse.json({ success: false, error: '供应商名称不能为空' }, { status: 400 });
      }
      const { data: duplicate } = await supabase
        .from('suppliers')
        .select('id')
        .eq('name', trimmedName)
        .neq('id', id)
        .limit(1);

      if (duplicate && duplicate.length > 0) {
        return NextResponse.json({ success: false, error: '供应商名称已存在' }, { status: 400 });
      }
    }

    // 校验枚举字段
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: '无效的状态值' }, { status: 400 });
    }
    if (rating !== undefined && !VALID_RATINGS.includes(rating)) {
      return NextResponse.json({ success: false, error: '无效的评级值' }, { status: 400 });
    }
    if (category !== undefined && category !== '' && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: '无效的供应类别' }, { status: 400 });
    }

    // 构建更新对象（只包含传入的字段，空字符串转 null）
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = String(name).trim();
    if (contactPerson !== undefined) updateData.contact_person = toNullIfEmpty(contactPerson);
    if (phone !== undefined) updateData.phone = toNullIfEmpty(phone);
    if (email !== undefined) updateData.email = toNullIfEmpty(email);
    if (category !== undefined) updateData.category = toNullIfEmpty(category);
    if (rating !== undefined) updateData.rating = rating;
    if (status !== undefined) updateData.status = status;
    if (address !== undefined) updateData.address = toNullIfEmpty(address);
    if (remark !== undefined) updateData.remark = toNullIfEmpty(remark);

    const { data, error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新供应商数据库错误:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '供应商不存在或更新失败' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('更新供应商失败:', error);
    return NextResponse.json({ success: false, error: '更新供应商失败' }, { status: 500 });
  }
}
