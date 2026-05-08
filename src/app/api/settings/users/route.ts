import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';
import { isUserAdmin } from '@/lib/auth-utils';

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('erp_user');
  if (!token) return null;
  try {
    return JSON.parse(token.value);
  } catch {
    return null;
  }
}

// GET - 获取用户列表（仅管理员）
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    if (!isUserAdmin(user)) {
      return NextResponse.json({ success: false, error: '无权限查看用户列表' }, { status: 403 });
    }

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');

    let query = supabase
      .from('users')
      .select('id, phone, real_name, role, department, is_active, tenant_id, tenant_type, created_at')
      .order('created_at', { ascending: false });

    // 如果指定了租户ID，过滤该租户的用户
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('获取用户列表失败:', error);
      return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, users: data || [] });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 });
  }
}

// POST - 创建新用户（仅管理员）
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    if (!isUserAdmin(currentUser)) {
      return NextResponse.json({ success: false, error: '无权限创建用户' }, { status: 403 });
    }

    const body = await request.json();
    const { phone, password, real_name, role, department } = body;

    // 验证必填字段
    if (!phone || !password) {
      return NextResponse.json({ success: false, error: '手机号和密码必填' }, { status: 400 });
    }

    // 验证手机号格式
    if (!/^1\d{10}$/.test(phone)) {
      return NextResponse.json({ success: false, error: '手机号格式不正确' }, { status: 400 });
    }

    // 验证密码强度
    if (password.length < 6) {
      return NextResponse.json({ success: false, error: '密码至少6位' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 检查手机号是否已存在
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, phone')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      return NextResponse.json({ success: false, error: '该手机号已存在' }, { status: 400 });
    }

    // 从当前登录用户获取 tenant_id 和 tenant_type
    const tenantId = currentUser.tenant_id;
    const tenantType = currentUser.tenant_type || 'manufacturer';

    if (!tenantId) {
      return NextResponse.json({ success: false, error: '无法获取租户信息' }, { status: 400 });
    }

    // 插入到 users 表
    const { data, error } = await supabase
      .from('users')
      .insert({
        phone,
        password,
        real_name: real_name || phone,
        role: role || 'user',
        department: department || null,
        tenant_id: tenantId,
        tenant_type: tenantType,
        is_active: true,
      })
      .select('id, phone, real_name, role, department, tenant_id, tenant_type, created_at')
      .single();

    if (error) {
      console.error('创建用户失败:', error);
      return NextResponse.json({ success: false, error: '创建用户失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('创建用户失败:', error);
    return NextResponse.json({ success: false, error: '创建用户失败' }, { status: 500 });
  }
}

// PUT - 更新用户（仅管理员）
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    if (!isUserAdmin(currentUser)) {
      return NextResponse.json({ success: false, error: '无权限修改用户' }, { status: 403 });
    }

    // 从 URL 查询参数获取用户 ID
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '用户ID必填' }, { status: 400 });
    }

    const body = await request.json();
    const { real_name, role, department, status, password } = body;

    const supabase = getSupabaseClient();

    // 构建更新数据
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (real_name !== undefined) updateData.real_name = real_name;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (status !== undefined) updateData.is_active = status === 'active';
    if (password) updateData.password = password;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, phone, real_name, role, department, is_active, tenant_id, tenant_type')
      .single();

    if (error) {
      console.error('更新用户失败:', error);
      return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
  }
}

// DELETE - 删除用户（仅管理员）
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    if (!isUserAdmin(currentUser)) {
      return NextResponse.json({ success: false, error: '无权限删除用户' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '用户ID必填' }, { status: 400 });
    }

    // 不允许删除自己
    if (id === currentUser.id) {
      return NextResponse.json({ success: false, error: '不能删除自己' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除用户失败:', error);
      return NextResponse.json({ success: false, error: '删除用户失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ success: false, error: '删除用户失败' }, { status: 500 });
  }
}
