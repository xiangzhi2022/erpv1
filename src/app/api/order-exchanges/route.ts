import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';
import { isValidOrderExchangeStatus } from '@/lib/order-exchange';

interface ExchangeRow {
  id: string;
  order_id: string;
  from_tenant_id: string;
  to_tenant_id: string;
  from_user_id: string;
  status: string;
  message: string | null;
  proposed_changes: unknown;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface OrderRow {
  id: string;
  order_no: string;
  customer_name: string;
  status: string;
  total_amount: string | number | null;
  delivery_date: string | null;
  tenant_id: string | null;
}

interface TenantRow {
  id: string;
  name: string | null;
  company_name: string | null;
  tenant_type: string | null;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const box = searchParams.get('box') || 'all';
    const status = searchParams.get('status');

    let query = supabase
      .from('order_exchanges')
      .select('*')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      if (!isValidOrderExchangeStatus(status)) return jsonError('流转状态无效', 400);
      query = query.eq('status', status);
    }

    if (!isSuperAdmin(user)) {
      if (!user.tenant_id) return jsonError('当前用户未关联企业', 403);
      if (box === 'inbox') query = query.eq('to_tenant_id', user.tenant_id);
      else if (box === 'outbox') query = query.eq('from_tenant_id', user.tenant_id);
      else query = query.or(`from_tenant_id.eq.${user.tenant_id},to_tenant_id.eq.${user.tenant_id}`);
    } else if (box === 'inbox' || box === 'outbox') {
      const tenantId = searchParams.get('tenant_id');
      if (tenantId) query = query.eq(box === 'inbox' ? 'to_tenant_id' : 'from_tenant_id', tenantId);
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);

    const exchanges = (data || []) as ExchangeRow[];
    const orderIds = Array.from(new Set(exchanges.map((row) => row.order_id)));
    const tenantIds = Array.from(new Set(exchanges.flatMap((row) => [row.from_tenant_id, row.to_tenant_id])));

    const [ordersRes, tenantsRes] = await Promise.all([
      orderIds.length > 0
        ? supabase.from('orders').select('id, order_no, customer_name, status, total_amount, delivery_date, tenant_id').in('id', orderIds)
        : Promise.resolve({ data: [] as OrderRow[], error: null }),
      tenantIds.length > 0
        ? supabase.from('tenants').select('id, name, company_name, tenant_type').in('id', tenantIds)
        : Promise.resolve({ data: [] as TenantRow[], error: null }),
    ]);

    const orderMap = new Map((ordersRes.data || []).map((order: OrderRow) => [order.id, order]));
    const tenantMap = new Map((tenantsRes.data || []).map((tenant: TenantRow) => [tenant.id, tenant]));

    const result = exchanges.map((exchange) => ({
      ...exchange,
      order: orderMap.get(exchange.order_id) || null,
      from_tenant: tenantMap.get(exchange.from_tenant_id) || null,
      to_tenant: tenantMap.get(exchange.to_tenant_id) || null,
    }));

    return NextResponse.json({ success: true, exchanges: result });
  } catch (error) {
    console.error('get order exchanges failed:', error);
    return jsonError('获取订单流转失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);

    const body = (await request.json()) as Record<string, unknown>;
    const orderId = typeof body.order_id === 'string' ? body.order_id : '';
    const toTenantId = typeof body.to_tenant_id === 'string' ? body.to_tenant_id : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const proposedChanges = body.proposed_changes && typeof body.proposed_changes === 'object' ? body.proposed_changes : null;
    const fromTenantId = isSuperAdmin(user) && typeof body.from_tenant_id === 'string' && body.from_tenant_id
      ? body.from_tenant_id
      : user.tenant_id;

    if (!orderId) return jsonError('缺少订单 ID', 400);
    if (!fromTenantId) return jsonError('当前用户未关联发起企业', 403);
    if (!toTenantId) return jsonError('请选择接收企业', 400);
    if (fromTenantId === toTenantId) return jsonError('发起企业和接收企业不能相同', 400);

    const supabase = getSupabaseClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tenant_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) return jsonError('订单不存在', 404);
    if (!isSuperAdmin(user) && order.tenant_id !== fromTenantId) {
      return jsonError('只能发起本企业订单流转', 403);
    }

    const { data, error } = await supabase
      .from('order_exchanges')
      .insert({
        order_id: orderId,
        from_tenant_id: fromTenantId,
        to_tenant_id: toTenantId,
        from_user_id: user.id,
        status: 'sent',
        message: message || null,
        proposed_changes: proposedChanges,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ success: true, exchange: data });
  } catch (error) {
    console.error('create order exchange failed:', error);
    return jsonError('创建订单流转失败', 500);
  }
}
