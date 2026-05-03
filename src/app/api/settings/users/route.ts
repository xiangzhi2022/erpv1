import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.COZE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');

    let query = supabase
      .from('tenant_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, users: data || [] });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { tenant_id, phone, password, name, role, department } = body;

    if (!phone || !password) {
      return NextResponse.json({ success: false, error: '手机号和密码必填' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 检查手机号是否已存在
    const { data: existing } = await supabase
      .from('tenant_users')
      .select('id')
      .eq('tenant_id', tenant_id || user.tenant_id)
      .eq('phone', phone)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: '该手机号已存在' }, { status: 400 });
    }

    // 检查系统用户表
    const { data: sysUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();

    if (sysUser) {
      // 更新系统用户的租户类型
      await supabase
        .from('users')
        .update({ 
          tenant_type: user.tenant_type || 'manufacturer',
          tenant_id: tenant_id || user.tenant_id 
        })
        .eq('phone', phone);
    } else {
      // 创建系统用户
      await supabase
        .from('users')
        .insert({
          phone,
          password,
          nickname: name || phone,
          role: 'user',
          tenant_type: user.tenant_type || 'manufacturer',
          tenant_id: tenant_id || user.tenant_id,
        });
    }

    // 创建租户用户
    const { data, error } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenant_id || user.tenant_id,
        phone,
        password,
        name: name || null,
        role: role || '普工',
        department: department || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('创建用户失败:', error);
    return NextResponse.json({ success: false, error: '创建用户失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, role, department, status, password } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '用户ID必填' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 获取要更新的用户信息
    const { data: targetUser } = await supabase
      .from('tenant_users')
      .select('phone')
      .eq('id', id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name;
    if (role) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (status) updateData.status = status;
    if (password) updateData.password = password;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tenant_users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 同步更新系统用户表
    if (name || password) {
      const sysUpdate: Record<string, string> = {};
      if (name) sysUpdate.nickname = name;
      if (password) sysUpdate.password = password;
      
      await supabase
        .from('users')
        .update(sysUpdate)
        .eq('phone', targetUser.phone);
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '用户ID必填' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 获取要删除的用户信息
    const { data: targetUser } = await supabase
      .from('tenant_users')
      .select('phone')
      .eq('id', id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 不允许删除自己
    if (targetUser.phone === user.phone) {
      return NextResponse.json({ success: false, error: '不能删除自己的账号' }, { status: 400 });
    }

    const { error } = await supabase
      .from('tenant_users')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // 从系统用户表中移除租户关联（可选，保留用户记录）
    await supabase
      .from('users')
      .update({ tenant_id: null })
      .eq('phone', targetUser.phone);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ success: false, error: '删除用户失败' }, { status: 500 });
  }
}
