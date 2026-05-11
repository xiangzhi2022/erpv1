import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';

// GET - 获取供应商的关联订单列表
// 通过 supplier_id 查询 orders 表获取相关订单
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId') || searchParams.get('supplier_id');

    if (!supplierId) {
      return NextResponse.json({ success: false, error: '缺少供应商ID (supplierId)' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 先验证供应商存在
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id, name, supplier_code')
      .eq('id', supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ success: false, error: '供应商不存在' }, { status: 404 });
    }

    // 查询该供应商关联的订单
    // 使用 orders 表的 target_factory_id 作为供应商关联字段
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_no, customer_name, customer_phone, status, total_amount, delivery_date, remark, created_at')
      .eq('target_factory_id', supplierId)
      .order('created_at', { ascending: false });
    if (!isSuperAdmin(user) && user.tenant_id !== supplierId) {
      return NextResponse.json({ success: false, error: '无权限查看该供应商订单' }, { status: 403 });
    }

    if (error) {
      console.error('获取供应商订单数据库错误:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        supplier_code: supplier.supplier_code,
      },
      orders: orders || [],
    });
  } catch (error) {
    console.error('获取供应商订单失败:', error);
    return NextResponse.json({ success: false, error: '获取供应商订单失败' }, { status: 500 });
  }
}
