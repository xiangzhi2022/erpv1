import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

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

// GET /api/customers - Fetch customers for order form selection
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (search && search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get customers error:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Get customers error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/customers - Create a new customer
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, address, remark } = body;

    if (!name) {
      return Response.json({ success: false, error: '客户名称不能为空' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('customers')
      .insert({
        name,
        phone: phone || null,
        address: address || null,
        remark: remark || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Create customer error:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Create customer error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
