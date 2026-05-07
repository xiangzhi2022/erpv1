import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: '请提供邮箱和验证码' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: '验证码必须是6位数字' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 查询最新未使用的验证码
    const { data, error } = await supabase
      .from('sms_codes')
      .select('*')
      .eq('phone', email)  // 使用 phone 字段存储邮箱
      .eq('code', code)
      .eq('used', false)
      .eq('type', 'email_verify')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('查询验证码失败:', error);
      return NextResponse.json(
        { success: false, error: '验证码验证失败' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: '验证码错误或已过期' },
        { status: 400 }
      );
    }

    // 标记验证码已使用
    await supabase
      .from('sms_codes')
      .update({ used: true })
      .eq('id', data[0].id);

    return NextResponse.json({
      success: true,
      message: '验证成功',
    });

  } catch (error) {
    console.error('验证失败:', error);
    return NextResponse.json(
      { success: false, error: '验证失败，请稍后重试' },
      { status: 500 }
    );
  }
}
