import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.COZE_SUPABASE_URL!;
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!;

// 获取当前登录用户
async function getCurrentUser() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get('erp_user');
  if (!userCookie) return null;
  try {
    return JSON.parse(decodeURIComponent(userCookie.value));
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: users, error } = await supabase
      .from('erp_users')
      .select('id, phone, name, role, department, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, users: users || [] });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { phone, password, name, role } = await request.json();

    if (!phone || !password) {
      return NextResponse.json({ success: false, error: '手机号和密码不能为空' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 检查手机号是否已存在
    const { data: existing } = await supabase
      .from('erp_users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: '该手机号已注册' }, { status: 400 });
    }

    // 创建用户（密码使用btoa简单编码）
    const { data, error } = await supabase
      .from('erp_users')
      .insert({
        phone,
        password: btoa(password),
        name: name || phone,
        role: role || '普工',
        status: 'active',
        created_by: currentUser.phone
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('添加用户失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
