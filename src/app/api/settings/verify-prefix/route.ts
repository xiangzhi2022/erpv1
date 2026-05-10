import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { isUserAdmin } from '@/lib/auth-utils';
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

// GET - 验证前缀是否可用
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix');

    if (!prefix) {
      return NextResponse.json(
        { success: false, error: '请提供要验证的前缀' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 从 order_prefixes 表查询
    const { data, error } = await supabase
      .from('order_prefixes')
      .select('prefix, company_name')
      .eq('prefix', prefix)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('查询前缀失败:', error);
      return NextResponse.json(
        { success: false, error: '验证失败' },
        { status: 500 }
      );
    }

    if (data) {
      return NextResponse.json({
        success: true,
        available: false,
        message: `该前缀已被"${data.company_name || '其他公司'}"使用`,
        companyName: data.company_name,
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
      message: '该前缀可用',
    });
  } catch (error) {
    console.error('验证前缀出错:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// POST - 保存前缀（仅限管理员）
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    // 使用统一的权限检查函数
    if (!isUserAdmin(user)) {
      return NextResponse.json(
        { success: false, error: '只有管理员才能设置订单前缀' },
        { status: 403 }
      );
    }

    const { prefix, companyName, phone, address } = await request.json();

    if (!prefix) {
      return NextResponse.json(
        { success: false, error: '请提供前缀' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 先检查前缀是否已存在
    const { data: existing } = await supabase
      .from('order_prefixes')
      .select('id, prefix')
      .eq('prefix', prefix.toUpperCase())
      .single();

    if (existing) {
      // 更新现有记录
      const { error } = await supabase
        .from('order_prefixes')
        .update({
          company_name: companyName || null,
          phone: phone || null,
          address: address || null,
        })
        .eq('prefix', prefix.toUpperCase());

      if (error) {
        console.error('更新前缀失败:', error);
        return NextResponse.json(
          { success: false, error: '更新失败' },
          { status: 500 }
        );
      }
    } else {
      // 插入新记录
      const { error } = await supabase
        .from('order_prefixes')
        .insert({
          prefix: prefix.toUpperCase(),
          company_name: companyName || null,
          phone: phone || null,
          address: address || null,
        });

      if (error) {
        console.error('保存前缀失败:', error);
        return NextResponse.json(
          { success: false, error: '保存失败' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: '前缀保存成功',
    });
  } catch (error) {
    console.error('保存前缀出错:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// DELETE - 删除前缀（仅限管理员）
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    if (!isUserAdmin(user)) {
      return NextResponse.json(
        { success: false, error: '只有管理员才能删除订单前缀' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix');

    if (!prefix) {
      return NextResponse.json(
        { success: false, error: '请提供要删除的前缀' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('order_prefixes')
      .delete()
      .eq('prefix', prefix);

    if (error) {
      console.error('删除前缀失败:', error);
      return NextResponse.json(
        { success: false, error: '删除失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '前缀删除成功',
    });
  } catch (error) {
    console.error('删除前缀出错:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
