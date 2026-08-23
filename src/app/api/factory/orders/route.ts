import { z } from 'zod';
import { ORDER_STATUSES } from '@/app/orders/schemas';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseQuery } from '@/lib/api/request';
import { NextResponse, type NextRequest } from 'next/server';
import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const factoryOrderQuerySchema = z.object({
  status: z.union([z.enum(ORDER_STATUSES), z.literal('all')]).optional(),
  keyword: z.string().trim().min(1).max(64)
    .regex(/^[\p{L}\p{N} -]+$/u, '关键词包含不支持的字符')
    .optional(),
});

const acceptOrderSchema = z.object({
  order_id: z.string().uuid(),
});

const ACCEPTABLE_FACTORY_ORDER_STATUSES = new Set(['pending']);

interface FactoryOrderItem {
  id: string;
  product_name: string;
  quantity: number;
}

interface FactoryOrderItemAmount {
  id: string;
  order_id: string;
  unit_price: number;
  subtotal: number;
}

interface FactoryOrderRow {
  id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  total_amount: number;
  delivery_date: string | null;
  remark: string | null;
  dealer_id: string | null;
  from_enterprise_id: string | null;
  target_factory_id: string | null;
  created_at: string;
  updated_at: string;
  items: FactoryOrderItem[] | null;
}

interface EnterpriseSummary {
  id: string;
  name: string;
}

interface ProductionTaskRow {
  order_id: string | null;
  status: string;
}

function buildTaskStats(tasks: readonly ProductionTaskRow[]) {
  const statsByOrderId = new Map<string, { total: number; completed: number }>();
  for (const task of tasks) {
    if (!task.order_id) continue;
    const stats = statsByOrderId.get(task.order_id) ?? { total: 0, completed: 0 };
    stats.total += 1;
    if (task.status === 'completed') stats.completed += 1;
    statsByOrderId.set(task.order_id, stats);
  }
  return statsByOrderId;
}

function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('factory_orders.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.read');
    const filters = parseQuery(request, factoryOrderQuerySchema);
    const supabase = await createClient();

    let query = supabase
      .from('orders')
      .select(`
        id, order_no, customer_name, customer_phone, status, total_amount,
        delivery_date, remark, dealer_id, from_enterprise_id, target_factory_id, created_at, updated_at,
        items:order_items(id, product_name, quantity)
      `)
      .eq('enterprise_id', context.enterpriseId)
      .eq('target_factory_id', context.enterpriseId)
      .order('created_at', { ascending: false });
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.keyword) query = query.or(`order_no.ilike.%${filters.keyword}%,customer_name.ilike.%${filters.keyword}%`);

    const { data: orders, error } = await query;
    if (error) {
      console.error('factory_orders.list_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
    }

    const orderList = (orders ?? []) as FactoryOrderRow[];
    const enterpriseIds = Array.from(new Set(
      orderList
        .flatMap((order) => [order.dealer_id, order.from_enterprise_id])
        .filter((value): value is string => Boolean(value)),
    ));
    const { data: enterpriseRows } = enterpriseIds.length > 0
      ? await supabase.from('enterprises').select('id,name').in('id', enterpriseIds)
      : { data: [] };
    const enterprisesById = new Map<string, EnterpriseSummary>(
      ((enterpriseRows ?? []) as EnterpriseSummary[]).map((enterprise) => [enterprise.id, {
        id: enterprise.id,
        name: enterprise.name,
      }]),
    );

    const orderIds = orderList.map((order) => order.id);
    const itemAmountsResult = hasEnterprisePermission(context, 'finance.read') && orderIds.length > 0
      ? await supabase.rpc('finance_list_order_item_amounts', {
          target_enterprise_id: context.enterpriseId,
          target_order_ids: orderIds,
        })
      : { data: [], error: null };
    if (itemAmountsResult.error) {
      console.error('factory_orders.item_amounts_failed', { code: itemAmountsResult.error.code });
      return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
    }
    const itemAmountsById = new Map<string, FactoryOrderItemAmount>(
      ((itemAmountsResult.data ?? []) as FactoryOrderItemAmount[]).map((item) => [item.id, item]),
    );
    const { data: taskRows } = orderIds.length > 0
      ? await supabase
          .from('production_tasks')
          .select('order_id,status')
          .eq('enterprise_id', context.enterpriseId)
          .in('order_id', orderIds)
      : { data: [] };
    const taskStatsByOrderId = buildTaskStats((taskRows ?? []) as ProductionTaskRow[]);

    const ordersWithProgress = orderList.map((order) => {
      const stats = taskStatsByOrderId.get(order.id) ?? { total: 0, completed: 0 };
      const dealerId = order.dealer_id ?? order.from_enterprise_id;
      return {
        id: order.id,
        order_no: order.order_no,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        status: order.status,
        total_amount: order.total_amount,
        delivery_date: order.delivery_date,
        remark: order.remark,
        target_factory_id: order.target_factory_id,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: (order.items ?? []).map((item) => {
          const amounts = itemAmountsById.get(item.id);
          return {
            id: item.id,
            product_name: item.product_name,
            quantity: item.quantity,
            ...(amounts ? {
              unit_price: amounts.unit_price,
              subtotal: amounts.subtotal,
            } : {}),
          };
        }),
        dealer: dealerId ? enterprisesById.get(dealerId) ?? null : null,
        total_tasks: stats.total,
        completed_tasks: stats.completed,
        progress: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      };
    });

    const { data: allOrders, error: statsError } = await supabase
      .from('orders')
      .select('id,status')
      .eq('enterprise_id', context.enterpriseId)
      .eq('target_factory_id', context.enterpriseId);
    if (statsError) console.error('factory_orders.stats_failed', { code: statsError.code });

    const statusStats = {
      pending: (allOrders ?? []).filter((order) => order.status === 'pending').length,
      confirmed: (allOrders ?? []).filter((order) => order.status === 'confirmed').length,
      producing: (allOrders ?? []).filter((order) => order.status === 'producing').length,
      shipped: (allOrders ?? []).filter((order) => order.status === 'shipped').length,
      completed: (allOrders ?? []).filter((order) => order.status === 'completed').length,
    };
    const allOrderIds = (allOrders ?? []).map((order) => order.id);
    const { data: allTaskRows } = allOrderIds.length > 0
      ? await supabase
          .from('production_tasks')
          .select('status')
          .eq('enterprise_id', context.enterpriseId)
          .in('order_id', allOrderIds)
      : { data: [] };
    const allTasks = allTaskRows ?? [];

    return NextResponse.json({
      success: true,
      orders: ordersWithProgress,
      stats: statusStats,
      taskStats: {
        total: allTasks.length,
        completed: allTasks.filter((task) => task.status === 'completed').length,
      },
    });
  } catch (error) {
    return errorResponse(error, '服务器错误');
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.accept');
    const { order_id: orderId } = await parseJson(request, acceptOrderSchema);

    const supabase = await createClient();
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select('id,status')
      .eq('enterprise_id', context.enterpriseId)
      .eq('target_factory_id', context.enterpriseId)
      .eq('id', orderId)
      .maybeSingle();
    if (existingOrderError) {
      console.error('factory_orders.accept_lookup_failed', { code: existingOrderError.code });
      return NextResponse.json({ success: false, error: '接收失败' }, { status: 500 });
    }
    if (!existingOrder) return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    if (!ACCEPTABLE_FACTORY_ORDER_STATUSES.has(existingOrder.status)) {
      return NextResponse.json({ success: false, error: '当前订单状态无法接收' }, { status: 409 });
    }

    const { data: updatedRows, error } = await supabase.rpc('transition_order_status' as never, {
      target_enterprise_id: context.enterpriseId,
      target_order_id: orderId,
      target_expected_status: existingOrder.status,
      target_status: 'confirmed',
      target_remark: '工厂接收订单',
    } as never);
    if (error) {
      console.error('factory_orders.accept_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '接收失败' }, { status: 500 });
    }
    if (!updatedRows) return NextResponse.json({ success: false, error: '订单状态已变更，请刷新后重试' }, { status: 409 });
    return NextResponse.json({ success: true, message: '订单已接收' });
  } catch (error) {
    return errorResponse(error, '服务器错误');
  }
}
