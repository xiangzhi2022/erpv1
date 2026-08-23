import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseParams } from '@/lib/api/request';
import type { Database } from '@/db/database.types';
import { getEnterpriseContext, requirePermission, type EnterpriseContext } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { ORDER_STATUS_VALUES } from '@/lib/four-level-order';
import type { OrderExchangeAction } from '@/lib/order-exchange';
import { createClient } from '@/lib/supabase/server';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderUpdate = Database['public']['Tables']['orders']['Update'];
type SpaceRow = Database['public']['Tables']['order_spaces']['Row'];
type ProductRow = Database['public']['Tables']['order_products']['Row'];
type TaskRow = Database['public']['Tables']['production_tasks']['Row'];
type StatusLogRow = Database['public']['Tables']['order_status_logs']['Row'];
type WorkerRow = Database['public']['Tables']['workers']['Row'];

type TaskDetail = TaskRow & {
  worker: Pick<WorkerRow, 'id' | 'name' | 'worker_no' | 'craft_type' | 'user_id'> | null;
};

type ProductDetail = ProductRow & { production_tasks: TaskDetail[] };
type SpaceDetail = SpaceRow & { products: ProductDetail[] };
type OrderDetail = OrderRow & {
  spaces: SpaceDetail[];
  status_logs: StatusLogRow[];
  external_progress: string;
};

const PATCHABLE_STRING_FIELDS = [
  'remark',
  'internal_remark',
  'customer_phone',
  'customer_address',
  'order_source',
  'delivery_date',
  'target_factory_id',
  'to_enterprise_id',
  'parent_order_id',
] as const;

const FINANCIAL_FIELDS = ['total_amount', 'deposit_amount', 'cost_amount', 'profit_amount'] as const;
const INTERNAL_ORDER_RESPONSE_FIELDS = ['cost_amount', 'profit_amount', 'internal_remark'] as const;
const PARTNER_TASK_IDENTITY_FIELDS = ['worker', 'assigned_worker_id', 'worker_id', 'assigned_to'] as const;
const paramsSchema = z.object({ id: z.string().uuid() });
const nullableTextSchema = z.string().trim().max(2000).nullable().optional();
const patchOrderSchema = z.object({
  action: z.literal('withdraw_exchange').optional(),
  status: z.string().trim().min(1).max(64).optional(),
  remark: nullableTextSchema,
  internal_remark: nullableTextSchema,
  customer_name: z.string().trim().min(1).max(200).optional(),
  customer_phone: z.string().trim().max(64).nullable().optional(),
  customer_address: z.string().trim().max(1000).nullable().optional(),
  order_source: z.string().trim().max(100).nullable().optional(),
  delivery_date: z.string().trim().max(64).nullable().optional(),
  target_factory_id: z.string().uuid().nullable().optional(),
  to_enterprise_id: z.string().uuid().nullable().optional(),
  parent_order_id: z.string().uuid().nullable().optional(),
  total_amount: z.number().finite().optional(),
  deposit_amount: z.number().finite().optional(),
  cost_amount: z.number().finite().optional(),
  profit_amount: z.number().finite().optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict().refine((input) => Object.keys(input).length > 0, '没有可更新的订单字段');

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function errorResponse(error: unknown, fallback: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) {
    return jsonError(error.message, error.status);
  }
  console.error('order_detail.request_failed', { error });
  return jsonError(fallback, 500);
}

function externalProgress(status: string | null): string {
  if (!status) return '订单已接收';
  if (['accepted', 'reviewed', 'submitted'].includes(status)) return '订单已接收';
  if (['pending_assign', 'assigned'].includes(status)) return '已排产';
  if (['producing', 'partially_completed', 'reworking'].includes(status)) return '生产中';
  if (status === 'pending_quality_check') return '质检中';
  if (status === 'quality_passed') return '生产完成';
  if (status === 'ready_to_ship') return '待发货';
  if (status === 'shipped') return '已发货';
  if (status === 'completed') return '已完成';
  if (['abnormal', 'quality_failed'].includes(status)) return '订单异常';
  return '订单已接收';
}

function isPartnerEnterprise(context: EnterpriseContext): boolean {
  return context.enterpriseType === 'dealer'
    || context.enterpriseType === 'supplier'
    || context.enterpriseType === 'material_supplier';
}

function canViewInternalFinancials(context: EnterpriseContext): boolean {
  return !isPartnerEnterprise(context)
    && (context.grants.has('finance.read') || context.grants.has('finance.manage'));
}

function canUpdateInternalFinancials(context: EnterpriseContext): boolean {
  return !isPartnerEnterprise(context) && context.grants.has('finance.manage');
}

function omitFields<T extends object, const TFields extends readonly (keyof T)[]>(
  value: T,
  fields: TFields,
): Omit<T, TFields[number]> {
  const copy = { ...value };
  for (const field of fields) Reflect.deleteProperty(copy, field);
  return copy as Omit<T, TFields[number]>;
}

function sanitizeOrderDetail(context: EnterpriseContext, tree: OrderDetail): object {
  const partner = isPartnerEnterprise(context);
  if (canViewInternalFinancials(context) && !partner) return { ...tree };

  const order = omitFields(tree, INTERNAL_ORDER_RESPONSE_FIELDS);
  return {
    ...order,
    spaces: tree.spaces.map((space) => ({
      ...space,
      products: space.products.map((product) => {
        const sanitizedProduct = omitFields(product, INTERNAL_ORDER_RESPONSE_FIELDS);
        return {
          ...sanitizedProduct,
          production_tasks: partner
            ? product.production_tasks.map((task) => omitFields(task, PARTNER_TASK_IDENTITY_FIELDS))
            : product.production_tasks,
        };
      }),
    })),
  };
}

async function loadOrderDetail(
  supabase: SupabaseClient<Database>,
  enterpriseId: string,
  orderId: string,
): Promise<{ tree: OrderDetail | null; failed: boolean }> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('enterprise_id', enterpriseId)
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) {
    console.error('order_detail.load_order_failed', { code: orderError.code });
    return { tree: null, failed: true };
  }
  if (!order) return { tree: null, failed: false };

  const [spacesResult, productsResult, tasksResult, logsResult] = await Promise.all([
    supabase.from('order_spaces').select('*')
      .eq('enterprise_id', enterpriseId).eq('order_id', orderId).order('sort_order', { ascending: true }),
    supabase.from('order_products').select('*')
      .eq('enterprise_id', enterpriseId).eq('order_id', orderId).order('sort_order', { ascending: true }),
    supabase.from('production_tasks').select('*')
      .eq('enterprise_id', enterpriseId).eq('order_id', orderId).order('created_at', { ascending: true }),
    supabase.from('order_status_logs').select('*')
      .eq('enterprise_id', enterpriseId)
      .in('target_type', ['order', 'space', 'product', 'production_task'])
      .order('changed_at', { ascending: false }),
  ]);
  if (spacesResult.error || productsResult.error || tasksResult.error || logsResult.error) {
    console.error('order_detail.load_tree_failed', {
      spaces: spacesResult.error?.code,
      products: productsResult.error?.code,
      tasks: tasksResult.error?.code,
      logs: logsResult.error?.code,
    });
    return { tree: null, failed: true };
  }

  const spaces = spacesResult.data || [];
  const products = productsResult.data || [];
  const tasks = tasksResult.data || [];
  const targetIds = new Set([orderId, ...spaces.map((space) => space.id), ...products.map((product) => product.id), ...tasks.map((task) => task.id)]);
  const workerIds = [...new Set(tasks
    .map((task) => task.assigned_worker_id || task.worker_id)
    .filter((workerId): workerId is string => Boolean(workerId)))];
  const workersResult = workerIds.length > 0
    ? await supabase.from('workers').select('id,name,worker_no,craft_type,user_id')
      .eq('enterprise_id', enterpriseId).in('id', workerIds)
    : { data: [] as Pick<WorkerRow, 'id' | 'name' | 'worker_no' | 'craft_type' | 'user_id'>[], error: null };
  if (workersResult.error) {
    console.error('order_detail.load_workers_failed', { code: workersResult.error.code });
    return { tree: null, failed: true };
  }
  const workers = new Map((workersResult.data || []).map((worker) => [worker.id, worker]));
  const tasksWithWorkers: TaskDetail[] = tasks.map((task) => ({
    ...task,
    worker: workers.get(task.assigned_worker_id || task.worker_id || '') || null,
  }));
  const productDetails: ProductDetail[] = products.map((product) => ({
    ...product,
    production_tasks: tasksWithWorkers.filter((task) => task.product_id === product.id),
  }));

  return {
    tree: {
      ...order,
      spaces: spaces.map((space) => ({
        ...space,
        products: productDetails.filter((product) => product.space_id === space.id),
      })),
      status_logs: (logsResult.data || []).filter((log) => targetIds.has(log.target_id)),
      external_progress: externalProgress(order.status),
    },
    failed: false,
  };
}

function setNullableStringField(
  update: OrderUpdate,
  body: Record<string, unknown>,
  field: (typeof PATCHABLE_STRING_FIELDS)[number],
): void {
  const value = body[field];
  if (typeof value === 'string' || value === null) update[field] = value;
}

async function transitionOrderExchanges(
  supabase: SupabaseClient<Database>,
  exchangeIds: string[],
  action: OrderExchangeAction,
  message?: string | null,
): Promise<string | null> {
  for (const exchangeId of exchangeIds) {
    const { error } = await supabase.rpc('transition_order_exchange', {
      target_exchange_id: exchangeId,
      target_action: action,
      target_message: message ?? null,
      target_proposed_changes: null,
    });
    if (error) return error.code;
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.read');
    const { id } = await parseParams(params, paramsSchema);
    const supabase = await createClient();
    const { tree, failed } = await loadOrderDetail(supabase, context.enterpriseId, id);
    if (failed) return jsonError('获取订单详情失败', 500);
    if (!tree) return jsonError('订单不存在', 404);
    return Response.json({ success: true, data: sanitizeOrderDetail(context, tree) });
  } catch (error) {
    return errorResponse(error, '获取订单详情失败');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.update');
    const { id } = await parseParams(params, paramsSchema);
    const body = await parseJson(request, patchOrderSchema);
    const requestedFinancialUpdate = FINANCIAL_FIELDS
      .some((field) => body[field] !== undefined);
    const requestedInternalUpdate = ['internal_remark', ...FINANCIAL_FIELDS]
      .some((field) => body[field as keyof typeof body] !== undefined);
    if (requestedInternalUpdate && !canUpdateInternalFinancials(context)) {
      return jsonError('无权修改内部字段', 403);
    }
    const supabase = await createClient();
    const { tree, failed } = await loadOrderDetail(supabase, context.enterpriseId, id);
    if (failed) return jsonError('查询订单失败', 500);
    if (!tree) return jsonError('订单不存在', 404);

    if (body.action === 'withdraw_exchange' || body.status === 'withdrawn') {
      const { data: withdrawnExchanges, error: withdrawError } = await supabase
        .from('order_exchanges')
        .select('id')
        .eq('enterprise_id', context.enterpriseId)
        .eq('order_id', id)
        .eq('from_enterprise_id', context.enterpriseId)
        .in('status', ['draft', 'sent', 'change_requested', 'accepted']);
      if (withdrawError) {
        console.error('order_detail.withdraw_exchange_failed', { code: withdrawError.code });
        return jsonError('撤回订单流转失败', 500);
      }
      if (!withdrawnExchanges || withdrawnExchanges.length === 0) return jsonError('没有可撤回的订单流转', 400);
      const transitionError = await transitionOrderExchanges(
        supabase,
        withdrawnExchanges.map((exchange) => exchange.id),
        'withdraw',
        typeof body.notes === 'string' ? body.notes : null,
      );
      if (transitionError) {
        console.error('order_detail.withdraw_exchange_failed', { code: transitionError });
        return jsonError(
          transitionError === 'P0001' ? '订单流转状态已变化' : '撤回订单流转失败',
          transitionError === 'P0001' ? 409 : 500,
        );
      }
      const refreshed = await loadOrderDetail(supabase, context.enterpriseId, id);
      if (refreshed.failed) return jsonError('获取订单详情失败', 500);
      return Response.json({ success: true, data: sanitizeOrderDetail(context, refreshed.tree || tree) });
    }

    const updateData: OrderUpdate = { updated_at: new Date().toISOString() };
    if (typeof body.customer_name === 'string' && body.customer_name.trim()) updateData.customer_name = body.customer_name.trim();
    for (const field of PATCHABLE_STRING_FIELDS) setNullableStringField(updateData, body, field);
    if (typeof body.notes === 'string' && body.notes.trim()) updateData.remark = body.notes.trim();

    if (body.status !== undefined) {
      const nextStatus = String(body.status);
      if (!ORDER_STATUS_VALUES.includes(nextStatus as (typeof ORDER_STATUS_VALUES)[number])) {
        return jsonError(`无效订单状态: ${nextStatus}`, 400);
      }
      updateData.status = nextStatus;
    }
    const hasDirectOrderUpdate = Object.keys(updateData).length > 1;
    if (!hasDirectOrderUpdate && !requestedFinancialUpdate) return jsonError('没有可更新的订单字段', 400);

    if (hasDirectOrderUpdate) {
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', id)
        .select()
        .single();
      if (error || !data) {
        console.error('order_detail.update_failed', { code: error?.code });
        return jsonError('更新订单失败', 500);
      }
    }

    if (requestedFinancialUpdate) {
      const { data: pricingRows, error: pricingError } = await supabase.rpc('finance_update_order_pricing', {
        target_enterprise_id: context.enterpriseId,
        target_order_id: id,
        target_total_amount: body.total_amount ?? null,
        target_cost_amount: body.cost_amount ?? null,
        target_profit_amount: body.profit_amount ?? null,
        target_deposit_amount: body.deposit_amount ?? null,
      });
      if (pricingError || !pricingRows?.[0]) {
        console.error('order_detail.pricing_update_failed', { code: pricingError?.code });
        return jsonError('更新订单财务字段失败', pricingError?.code === '42501' ? 403 : 500);
      }
    }

    if (typeof updateData.status === 'string' && updateData.status !== tree.status) {
      const { error: logError } = await supabase.from('order_status_logs').insert({
        enterprise_id: context.enterpriseId,
        target_type: 'order',
        target_id: id,
        from_status: tree.status,
        to_status: updateData.status,
        changed_by: context.userId,
        remark: typeof body.notes === 'string' ? body.notes : null,
      });
      if (logError) {
        console.error('order_detail.status_log_failed', { code: logError.code });
        return jsonError('更新订单失败', 500);
      }
    }

    if (body.status === 'accepted' || body.status === 'reviewed') {
      const { data: exchanges, error: exchangeLookupError } = await supabase
        .from('order_exchanges')
        .select('id')
        .eq('enterprise_id', context.enterpriseId)
        .eq('order_id', id)
        .eq('to_enterprise_id', context.enterpriseId)
        .in('status', ['sent', 'change_requested']);
      const exchangeError = exchangeLookupError?.code ?? await transitionOrderExchanges(
        supabase,
        (exchanges ?? []).map((exchange) => exchange.id),
        'accept',
      );
      if (exchangeError) {
        console.error('order_detail.accept_exchange_failed', { code: exchangeError });
        return jsonError('更新订单失败', 500);
      }
    }

    if (body.status === 'cancelled') {
      const { data: exchanges, error: exchangeLookupError } = await supabase
        .from('order_exchanges')
        .select('id')
        .eq('enterprise_id', context.enterpriseId)
        .eq('order_id', id)
        .in('status', ['sent', 'change_requested']);
      const exchangeError = exchangeLookupError?.code ?? await transitionOrderExchanges(
        supabase,
        (exchanges ?? []).map((exchange) => exchange.id),
        'withdraw',
        typeof body.notes === 'string' ? body.notes : null,
      );
      if (exchangeError) {
        console.error('order_detail.cancel_exchange_failed', { code: exchangeError });
        return jsonError('更新订单失败', 500);
      }
    }

    const refreshed = await loadOrderDetail(supabase, context.enterpriseId, id);
    if (refreshed.failed) return jsonError('获取订单详情失败', 500);
    return Response.json({ success: true, data: sanitizeOrderDetail(context, refreshed.tree || tree) });
  } catch (error) {
    return errorResponse(error, '更新订单失败');
  }
}
