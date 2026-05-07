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

// GET - 获取供应商列表（支持搜索、分类筛选、评级筛选）
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const category = searchParams.get('category') || '';
    const rating = searchParams.get('rating') || '';
    const status = searchParams.get('status') || '';

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('suppliers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 按关键词模糊搜索（名称/联系人/电话）
    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,contact_person.ilike.%${keyword}%,phone.ilike.%${keyword}%`);
    }

    // 按分类筛选
    if (category) {
      query = query.eq('category', category);
    }

    // 按评级筛选
    if (rating) {
      query = query.eq('rating', rating);
    }

    // 按状态筛选
    if (status) {
      query = query.eq('status', status);
    }

    const { data: suppliers, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: suppliers || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('获取供应商列表失败:', error);
    return NextResponse.json({ success: false, error: '获取供应商列表失败' }, { status: 500 });
  }
}
