import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { phone, password, nickname } = await request.json();

    // 验证手机号
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的手机号' },
        { status: 400 }
      );
    }

    // 验证密码
    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: '密码至少6位' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // 检查手机号是否已注册
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: '该手机号已注册' },
        { status: 400 }
      );
    }

    // 生成用户ID
    const userId = randomUUID();

    // 创建用户
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        phone,
        password,
        nickname: nickname || `用户${phone.slice(-4)}`,
        role: 'user',
        is_active: true,
      });

    if (insertError) {
      console.error('创建用户失败:', insertError);
      return NextResponse.json(
        { success: false, error: '注册失败，请稍后重试' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '注册成功',
      user: {
        id: userId,
        phone,
        nickname: nickname || `用户${phone.slice(-4)}`,
        role: 'user',
      }
    });

  } catch (error) {
    console.error('注册失败:', error);
    return NextResponse.json(
      { success: false, error: '注册失败，请稍后重试' },
      { status: 500 }
    );
  }
}
