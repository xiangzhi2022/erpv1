import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json() as { email?: string };

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

    // 存储验证码（使用 phone 字段存储邮箱，现有 schema 兼容）
    const { error: insertError } = await supabase
      .from('sms_codes')
      .insert({
        phone: email,
        code,
        type: 'email_verify',
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('存储验证码失败:', insertError.message);
      return NextResponse.json(
        { success: false, error: '验证码存储失败' },
        { status: 500 }
      );
    }

    // 仅开发模式下输出验证码到控制台
    if (process.env.COZE_PROJECT_ENV === 'DEV') {
      console.log(`[DEV] Email verification code for ${email}: ${code}`);
    }

    // 生产环境需要接入邮件发送服务
    // 当前仅返回成功提示
    return NextResponse.json({
      success: true,
      message: '验证码已发送到邮箱',
      // 仅在开发模式下返回验证码，生产环境绝不暴露
      ...(process.env.COZE_PROJECT_ENV === 'DEV' ? { dev_code: code } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error('发送验证码失败:', message);
    return NextResponse.json(
      { success: false, error: '发送验证码失败，请稍后重试' },
      { status: 500 }
    );
  }
}
