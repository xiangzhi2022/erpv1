import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';

// 每次请求时创建新的客户端（确保环境变量已加载）
const getClient = () => getSupabaseClient();

// 获取当前登录用户
async function getCurrentUser() {
  const cookieStore = await cookies();
  const userStr = cookieStore.get('erp_user')?.value;
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// 获取订单列表
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // 权限过滤：超级管理员可见所有，普通用户只能看自己的
    if (user.role !== 'super_admin') {
      query = query.eq('created_by', user.id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Get orders error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// 创建订单
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const orderData = await request.json();
    const supabase = getClient();

    const { data, error } = await supabase
      .from('orders')
      .insert({
        ...orderData,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Create order error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
