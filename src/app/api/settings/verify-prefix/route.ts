import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix');

    if (!prefix) {
      return NextResponse.json(
        { success: false, error: '请提供要验证的前缀' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // 从新的order_prefixes表查询
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
        message: `该前缀已被"${data.company_name}"使用`,
        companyName: data.company_name
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
      message: '该前缀可用'
    });
  } catch (error) {
    console.error('验证前缀出错:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 保存前缀（仅限超级管理员）
export async function POST(request: NextRequest) {
  try {
    // 获取当前用户
    const cookieStore = await import('next/headers').then(m => m.cookies());
    const userCookie = cookieStore.get('erp_user');
    
    if (!userCookie) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }
    
    const user = JSON.parse(userCookie.value);
    
    // 仅限超级管理员
    if (user.role !== 'super_admin') {
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

    const supabase = getSupabaseServiceClient();

    // 先检查前缀是否已存在
    const { data: existing } = await supabase
      .from('order_prefixes')
      .select('id')
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
          updated_at: new Date().toISOString()
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
          created_by: user.phone
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
      message: '前缀保存成功'
    });
  } catch (error) {
    console.error('保存前缀出错:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 删除前缀（仅限超级管理员）
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await import('next/headers').then(m => m.cookies());
    const userCookie = cookieStore.get('erp_user');
    
    if (!userCookie) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }
    
    const user = JSON.parse(userCookie.value);
    
    if (user.role !== 'super_admin') {
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

    const supabase = getSupabaseServiceClient();

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
      message: '前缀删除成功'
    });
  } catch (error) {
    console.error('删除前缀出错:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
