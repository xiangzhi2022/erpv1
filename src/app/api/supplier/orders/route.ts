import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.COZE_SUPABASE_URL || 'https://cdcnjtgabgjkouavwxsl.supabase.co';
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

// GET - 获取材料商订单列表
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    // 检查是否是材料商管理员
    if (user.role !== 'supplier_admin' && user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    
    // 获取当前租户的材料订单
    const { data: orders, error } = await supabase
      .from('material_orders')
      .select('*')
      .eq('supplier_id', user.tenant_id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, orders: orders || [] });
  } catch (error) {
    console.error('获取材料订单失败:', error);
    return NextResponse.json({ success: false, error: '获取材料订单失败' }, { status: 500 });
  }
}

// POST - 创建材料订单
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    if (user.role !== 'supplier_admin' && user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { customer_name, items, total_amount } = body;

    if (!customer_name || !items || !total_amount) {
      return NextResponse.json({ success: false, error: '缺少必填字段' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 生成订单号
    const orderNo = `SC${Date.now()}`;

    const { data, error } = await supabase
      .from('material_orders')
      .insert({
        order_no: orderNo,
        supplier_id: user.tenant_id,
        customer_name,
        items,
        total_amount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: data });
  } catch (error) {
    console.error('创建材料订单失败:', error);
    return NextResponse.json({ success: false, error: '创建材料订单失败' }, { status: 500 });
  }
}
