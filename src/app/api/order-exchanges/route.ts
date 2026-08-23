import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isValidOrderExchangeStatus } from '@/lib/order-exchange';
import { createClient } from '@/lib/supabase/server';

const exchangeCreateSchema = z.object({
  order_id: z.string().uuid(),
  to_tenant_id: z.string().uuid(),
  message: z.string().trim().max(2000).optional(),
  proposed_changes: z.json().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.read');
    const box = request.nextUrl.searchParams.get('box') || 'all';
    const status = request.nextUrl.searchParams.get('status');
    if (status && status !== 'all' && !isValidOrderExchangeStatus(status)) {
      return NextResponse.json({ success: false, error: '流转状态无效' }, { status: 400 });
    }
    const supabase = await createClient();
    let query = supabase
      .from('order_exchanges')
      .select('*')
      .order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    if (box === 'inbox') query = query.eq('to_enterprise_id', context.enterpriseId);
    else if (box === 'outbox') query = query.eq('from_enterprise_id', context.enterpriseId);
    else query = query.or(
      `from_enterprise_id.eq.${context.enterpriseId},to_enterprise_id.eq.${context.enterpriseId}`,
    );
    const { data, error } = await query;
    if (error) {
      console.error('order_exchanges.list_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '获取订单流转失败' }, { status: 500 });
    }
    const exchanges = data || [];
    const enterpriseIds = [...new Set(exchanges.flatMap(
      (exchange) => [exchange.from_enterprise_id, exchange.to_enterprise_id],
    ))];
    const { data: enterprises } = enterpriseIds.length
      ? await supabase
          .from('enterprises')
          .select('id,name,code,enterprise_type')
          .in('id', enterpriseIds)
      : { data: [] };
    const enterpriseMap = new Map((enterprises || []).map((enterprise) => [enterprise.id, enterprise]));
    const result = exchanges.map((exchange) => ({
      ...exchange,
      from_tenant_id: exchange.from_enterprise_id,
      to_tenant_id: exchange.to_enterprise_id,
      from_tenant: enterpriseMap.get(exchange.from_enterprise_id) || null,
      to_tenant: enterpriseMap.get(exchange.to_enterprise_id) || null,
      order: null,
    }));
    return NextResponse.json({ success: true, exchanges: result });
  } catch (error) {
    console.error('order_exchanges.list_failed', { error });
    return NextResponse.json({ success: false, error: '获取订单流转失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.submit');
    const input = await parseJson(request, exchangeCreateSchema);
    if (input.to_tenant_id === context.enterpriseId) {
      return NextResponse.json({ success: false, error: '发起企业和接收企业不能相同' }, { status: 400 });
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('create_order_exchange', {
      target_from_enterprise_id: context.enterpriseId,
      target_order_id: input.order_id,
      target_to_enterprise_id: input.to_tenant_id,
      target_message: input.message || null,
      target_proposed_changes: input.proposed_changes ?? null,
    });
    if (error) {
      console.error('order_exchanges.create_failed', { code: error.code });
      if (error.code === 'P0002') {
        return NextResponse.json({ success: false, error: '订单或接收企业不存在' }, { status: 404 });
      }
      if (error.code === '42501') {
        return NextResponse.json({ success: false, error: '无权发起订单流转' }, { status: 403 });
      }
      return NextResponse.json({ success: false, error: '创建订单流转失败' }, { status: 500 });
    }
    const exchange = data?.[0];
    if (!exchange) {
      return NextResponse.json({ success: false, error: '创建订单流转失败' }, { status: 500 });
    }
    return NextResponse.json({ success: true, exchange });
  } catch (error) {
    console.error('order_exchanges.create_failed', { error });
    return NextResponse.json({ success: false, error: '创建订单流转失败' }, { status: 500 });
  }
}
