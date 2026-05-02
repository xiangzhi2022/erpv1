import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();
    
    if (!phone || !password) {
      return Response.json(
        { success: false, error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // 查询用户
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .eq('is_active', true)
      .limit(1);

    if (userError) {
      console.error('Database error:', userError);
      return Response.json(
        { success: false, error: '数据库查询失败' },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return Response.json(
        { success: false, error: '用户不存在' },
        { status: 401 }
      );
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = user.password === password;

    if (!isValidPassword) {
      return Response.json(
        { success: false, error: '密码错误' },
        { status: 401 }
      );
    }

    // 构建用户信息
    const userInfo = {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      role: user.role,
      created_at: user.created_at,
    };

    // 设置Cookie
    const response = NextResponse.json({
      success: true,
      user: userInfo,
    });

    response.cookies.set('user', JSON.stringify(userInfo), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Login error:', error);
    return Response.json(
      { success: false, error: '服务器错误: ' + error.message },
      { status: 500 }
    );
  }
}
