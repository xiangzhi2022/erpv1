import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: '请输入正确的邮箱地址' },
        { status: 400 }
      );
    }

    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 验证码5分钟过期
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const supabase = getSupabaseClient();

    // 存储验证码
    const { error: insertError } = await supabase
      .from('sms_codes')
      .insert({
        phone: email,  // 使用 phone 字段存储邮箱
        code,
        type: 'email_verify',
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('存储验证码失败:', insertError);
      return NextResponse.json(
        { success: false, error: '验证码存储失败' },
        { status: 500 }
      );
    }

    // 实际项目中，这里需要调用邮件发送服务发送验证码
    // 目前仅返回验证码用于测试
    console.log(`邮箱验证码: ${email} -> ${code}`);

    return NextResponse.json({
      success: true,
      message: '验证码已发送到邮箱',
      // 测试环境下返回验证码
      code: process.env.NODE_ENV === 'development' ? code : undefined,
    });

  } catch (error) {
    console.error('发送验证码失败:', error);
    return NextResponse.json(
      { success: false, error: '发送验证码失败，请稍后重试' },
      { status: 500 }
    );
  }
}
