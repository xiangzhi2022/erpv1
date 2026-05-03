import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();
    
    if (!phone || !password) {
      return Response.json(
        { success: false, error: '手机号和密码不能为空' },
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
      // 用户不在users表，检查是否在tenant_users表中
      const { data: tenantUsers, error: tenantError } = await supabase
        .from('tenant_users')
        .select('*, tenants!inner(tenant_type)')
        .eq('phone', phone)
        .eq('status', 'active')
        .single();

      if (tenantError || !tenantUsers) {
        return Response.json(
          { success: false, error: '用户不存在' },
          { status: 401 }
        );
      }

      // 验证密码
      const isValidPassword = tenantUsers.password === password;

      if (!isValidPassword) {
        return Response.json(
          { success: false, error: '密码错误' },
          { status: 401 }
        );
      }

      // 构建租户用户信息
      const tenantUserInfo = {
        id: tenantUsers.id,
        phone: tenantUsers.phone,
        nickname: tenantUsers.name || tenantUsers.phone,
        role: tenantUsers.role,
        tenant_id: tenantUsers.tenant_id,
        tenant_type: (tenantUsers.tenants as unknown as { tenant_type: string }).tenant_type,
        created_at: tenantUsers.created_at,
      };

      const response = NextResponse.json({
        success: true,
        user: tenantUserInfo,
      });

      response.cookies.set('erp_user', JSON.stringify(tenantUserInfo), {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      return response;
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

    // 如果users表没有tenant_type，尝试从tenant_users获取
    let tenantType = user.tenant_type;
    let tenantId = user.tenant_id;

    if (!tenantType) {
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id, tenants!inner(tenant_type)')
        .eq('phone', phone)
        .single();

      if (tenantUser) {
        tenantId = tenantUser.tenant_id;
        tenantType = (tenantUser.tenants as unknown as { tenant_type: string }).tenant_type;
      }
    }

    // 构建用户信息
    const userInfo = {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      role: user.role,
      tenant_id: tenantId || null,
      tenant_type: tenantType || null,
      created_at: user.created_at,
    };

    // 设置Cookie（用于API认证）
    const response = NextResponse.json({
      success: true,
      user: userInfo,
    });

    response.cookies.set('erp_user', JSON.stringify(userInfo), {
      httpOnly: false, // 前端需要读取，所以不能设为true
      secure: true, // 云端使用 HTTPS
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
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
