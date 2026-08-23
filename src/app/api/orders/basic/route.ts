import { parseJsonObject } from '@/lib/api/request';
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';
import { canCreateOrderInMode, type OrderMode } from '@/lib/order-flow';

interface BasicOrderBody {
  existing_order_id?: unknown;
  order_no?: unknown;
  order_flow?: unknown;
  parent_order_id?: unknown;
  customer_name?: unknown;
  customer_phone?: unknown;
  customer_address?: unknown;
  delivery_date?: unknown;
  remark?: unknown;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!user.tenant_id) return jsonError('当前用户未关联企业', 403);

    const body = (await parseJsonObject(request)) as BasicOrderBody;
    const orderNo = stringValue(body.order_no);
    const orderName = stringValue(body.customer_name);
    const orderFlow = body.order_flow === 'factory_to_supplier' ? 'factory_to_supplier' : 'dealer_to_factory';
    const mode: OrderMode = orderFlow === 'dealer_to_factory' ? 'dealer' : 'factory_material';
    const existingOrderId = stringValue(body.existing_order_id);

    if (!canCreateOrderInMode(user, mode)) return jsonError('无权限创建该类型订单', 403);
    if (!orderNo) return jsonError('订单编号不能为空', 400);
    if (!orderName) return jsonError('订单名称不能为空', 400);

    const supabase = getSupabaseClient();
    let existingNoQuery = supabase.from('orders').select('id').eq('order_no', orderNo);
    if (existingOrderId) existingNoQuery = existingNoQuery.neq('id', existingOrderId);
    const { data: existingNo, error: existingNoError } = await existingNoQuery.maybeSingle();
    if (existingNoError) return jsonError(existingNoError.message, 500);
    if (existingNo) return jsonError('订单号已存在，请重新生成', 409);

    const now = new Date().toISOString();
    const payload = {
      order_no: orderNo,
      customer_name: orderName,
      customer_phone: stringValue(body.customer_phone) || null,
      customer_address: stringValue(body.customer_address) || null,
      status: 'pending',
      total_amount: 0,
      delivery_date: stringValue(body.delivery_date) || null,
      remark: stringValue(body.remark) || null,
      tenant_id: user.tenant_id,
      target_factory_id: null,
      dealer_id: orderFlow === 'dealer_to_factory' ? user.tenant_id : null,
      order_flow: orderFlow,
      from_tenant_id: user.tenant_id,
      to_tenant_id: null,
      parent_order_id: stringValue(body.parent_order_id) || null,
      updated_at: now,
    };

    if (existingOrderId) {
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id, tenant_id, from_tenant_id')
        .eq('id', existingOrderId)
        .maybeSingle();
      if (existingOrderError) return jsonError(existingOrderError.message, 500);
      if (!existingOrder) return jsonError('订单不存在', 404);
      if (!isSuperAdmin(user) && existingOrder.tenant_id !== user.tenant_id && existingOrder.from_tenant_id !== user.tenant_id) {
        return jsonError('只能保存本企业订单', 403);
      }

      const { data, error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', existingOrderId)
        .select()
        .single();
      if (error || !data) return jsonError(error?.message || '保存订单失败', 500);
      return NextResponse.json({ success: true, data });
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({
        ...payload,
        created_by: user.id,
      })
      .select()
      .single();
    if (error || !data) return jsonError(error?.message || '保存订单失败', 500);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('save basic order failed:', error);
    return jsonError(error instanceof Error ? error.message : '保存订单失败', 500);
  }
}
