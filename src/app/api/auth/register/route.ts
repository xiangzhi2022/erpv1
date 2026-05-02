import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, password, nickname } = await request.json();

    // 验证邮箱
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的邮箱地址' },
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

    // 检查邮箱是否已注册
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: '该邮箱已注册' },
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
        phone: email,
        password,
        nickname: nickname || `用户${email.split('@')[0]}`,
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
        email,
        nickname: nickname || `用户${email.split('@')[0]}`,
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
