import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';

// 每次请求时创建新的客户端（确保环境变量已加载）
const getClient = () => getSupabaseClient();

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();
    const supabase = getClient();

    if (!phone || !password) {
      return Response.json(
        { success: false, error: '请输入手机号和密码' },
        { status: 400 }
      );
    }

    // 查询用户
    const { data: user, error } = await supabase
      .from('users')
      .select('id, phone, nickname, role, is_active, password')
      .eq('phone', phone)
      .single();

    if (error || !user) {
      return Response.json(
        { success: false, error: '用户不存在' },
        { status: 401 }
      );
    }

    // 检查用户是否激活
    if (!user.is_active) {
      return Response.json(
        { success: false, error: '账户已被禁用' },
        { status: 403 }
      );
    }

    // 验证密码（简单比较，生产环境应使用加密）
    if (user.password !== password) {
      return Response.json(
        { success: false, error: '手机号或密码错误' },
        { status: 401 }
      );
    }

    // 更新最后登录时间
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // 设置登录Cookie
    const userInfo = {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      role: user.role
    };

    const cookieStore = await cookies();
    cookieStore.set('current_user', JSON.stringify(userInfo), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7天
    });

    // 返回用户信息（不含密码）
    return Response.json({
      success: true,
      user: userInfo
    });

  } catch (err) {
    console.error('Login error:', err);
    return Response.json(
      { success: false, error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
