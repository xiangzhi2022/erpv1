import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

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

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    const { data: roles, error } = await supabase
      .from('sys_roles')
      .select('id, role_name, dept')
      .order('sort_order');

    if (error) {
      console.error('获取角色列表失败:', error);
      return NextResponse.json({ success: false, error: '获取角色列表失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, roles });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return NextResponse.json({ success: false, error: '获取角色列表失败' }, { status: 500 });
  }
}
