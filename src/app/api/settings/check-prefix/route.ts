import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

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

// POST - 验证前缀是否可用（需要登录）
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const { prefix } = await request.json();

    if (!prefix || prefix.length < 1) {
      return NextResponse.json(
        { success: false, error: '前缀不能为空' },
        { status: 400 }
      );
    }

    const upperPrefix = prefix.toUpperCase();
    const supabase = getSupabaseClient();

    // 从 order_prefixes 表查询
    const { data, error } = await supabase
      .from('order_prefixes')
      .select('prefix, company_name')
      .eq('prefix', upperPrefix)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('验证前缀失败:', error);
      return NextResponse.json(
        { success: false, error: '验证失败，请重试' },
        { status: 500 }
      );
    }

    if (data) {
      return NextResponse.json({
        success: true,
        available: false,
        message: `该前缀已被"${data.company_name || '其他公司'}"使用`,
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
      message: '该前缀可用',
    });
  } catch (error) {
    console.error('验证前缀失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
