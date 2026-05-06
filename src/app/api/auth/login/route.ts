import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 硬编码的 Supabase 配置（不依赖环境变量）
const supabaseUrl = 'https://cdcnjtgabgjkouavwxsl.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY25qdGdhYmdqa291YXZ3eHNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg1MjM0MSwiZXhwIjoyMDkzNDI4MzQxfQ.LzvwvnkQx_lIjIjsZd8FxyXRaDwTPyiVELyTEuTacmE';

function getSupabaseServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

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
      .limit(1);

    if (userError) {
      console.error('Database error:', userError);
      return Response.json(
        { success: false, error: '数据库查询失败: ' + userError.message },
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

    // 获取租户类型（适配：tenants表使用type而不是tenant_type）
    let tenantType = null;
    let tenantName = null;
    
    if (user.tenant_id) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('type, name')
        .eq('id', user.tenant_id)
        .single();
      
      if (tenantData) {
        tenantType = tenantData.type;
        tenantName = tenantData.name;
      }
    }

    // 构建用户信息（适配：real_name → nickname）
    const userInfo = {
      id: user.id,
      phone: user.phone,
      nickname: user.real_name || user.nickname || user.phone,
      role: user.role,
      tenant_id: user.tenant_id || null,
      tenant_type: tenantType || null,
      tenant_name: tenantName || null,
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
