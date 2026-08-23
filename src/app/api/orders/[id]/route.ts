import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseParams } from '@/lib/api/request';
import type { Database } from '@/db/database.types';
import { getEnterpriseContext, hasEnterprisePermission, requirePermission, type EnterpriseContext } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { ORDER_STATUS_VALUES } from '@/lib/four-level-order';
import { createClient } from '@/lib/supabase/server';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderUpdate = Database['public']['Tables']['orders']['Update'];
type SpaceRow = Database['public']['Tables']['order_spaces']['Row'];
type ProductRow = Database['public']['Tables']['order_products']['Row'];
type TaskRow = Database['public']['Tables']['production_tasks']['Row'];
type StatusLogRow = Database['public']['Tables']['order_status_logs']['Row'];
type WorkerRow = Database['public']['Tables']['workers']['Row'];

type OrderFinancialFields = Pick<OrderRow, 'deposit_amount' | 'cost_amount' | 'profit_amount' | 'internal_remark'>;
type ProductFinancialFields = Pick<ProductRow, 'quoted_amount' | 'cost_amount' | 'profit_amount' | 'internal_remark'>;
type TaskWageFields = Pick<TaskRow, 'wage_rule_id' | 'estimated_wage_amount' | 'final_wage_amount'>;
type SafeOrderRow = Omit<OrderRow, keyof OrderFinancialFields> & Partial<OrderFinancialFields>;
type SafeProductRow = Omit<ProductRow, keyof ProductFinancialFields> & Partial<ProductFinancialFields>;
type SafeTaskRow = Omit<TaskRow, keyof TaskWageFields> & Partial<TaskWageFields>;

type TaskDetail = SafeTaskRow & {
  worker: Pick<WorkerRow, 'id' | 'name' | 'worker_no' | 'craft_type' | 'user_id'> | null;
};

type ProductDetail = SafeProductRow & { production_tasks: TaskDetail[] };
type SpaceDetail = SpaceRow & { products: ProductDetail[] };
type OrderDetail = SafeOrderRow & {
  spaces: SpaceDetail[];
  status_logs: StatusLogRow[];
  external_progress: string;
};

type FinanceOrderDetail = {
  order: { id: string } & OrderFinancialFields;
  products: Array<{ id: string } & ProductFinancialFields>;
};
type WageTaskDetail = Array<{ id: string } & TaskWageFields>;

const SAFE_ORDER_COLUMNS = 'id,enterprise_id,order_no,customer_name,customer_phone,customer_address,order_source,status,total_amount,target_factory_id,dealer_id,order_flow,from_enterprise_id,to_enterprise_id,parent_order_id,delivery_date,remark,created_by,created_at,updated_at';
const SAFE_PRODUCT_COLUMNS = 'id,enterprise_id,order_id,space_id,product_no,product_name,product_type,product_model,width,height,depth,area,quantity,material,color,status,sort_order,remark,created_at,updated_at';
const SAFE_TASK_COLUMNS = 'id,enterprise_id,order_id,space_id,product_id,work_order_id,task_no,task_type,task_name,task_code,product_name,quantity,unit,length,width,thickness,area,material,color,process_name,status,priority,progress,completed,workshop_id,workstation_id,assigned_to,assigned_worker_id,worker_id,planned_start_date,planned_end_date,actual_start_date,actual_end_date,start_date,end_date,started_at,submitted_at,completed_at,approved_by,approved_at,remark,created_at,updated_at';

const PATCHABLE_STRING_FIELDS = [
  'remark',
  'customer_phone',
  'customer_address',
  'order_source',
  'delivery_date',
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
    && hasEnterprisePermission(context, 'finance.read');
}

function canUpdateInternalFinancials(context: EnterpriseContext): boolean {
  return !isPartnerEnterprise(context) && hasEnterprisePermission(context, 'finance.manage');
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
  context: EnterpriseContext,
  orderId: string,
): Promise<{ tree: OrderDetail | null; failed: boolean }> {
  const enterpriseId = context.enterpriseId;
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(SAFE_ORDER_COLUMNS)
    .eq('enterprise_id', enterpriseId)
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) {
    console.error('order_detail.load_order_failed', { code: orderError.code });
    return { tree: null, failed: true };
  }
  if (!order) return { tree: null, failed: false };

  const [spacesResult, productsResult, tasksResult, logsResult, financeResult, wagesResult] = await Promise.all([
    supabase.from('order_spaces').select('*')
      .eq('enterprise_id', enterpriseId).eq('order_id', orderId).order('sort_order', { ascending: true }),
    supabase.from('order_products').select(SAFE_PRODUCT_COLUMNS)
      .eq('enterprise_id', enterpriseId).eq('order_id', orderId).order('sort_order', { ascending: true }),
    supabase.from('production_tasks').select(SAFE_TASK_COLUMNS)
      .eq('enterprise_id', enterpriseId).eq('order_id', orderId).order('created_at', { ascending: true }),
    supabase.from('order_status_logs').select('*')
      .eq('enterprise_id', enterpriseId)
      .in('target_type', ['order', 'space', 'product', 'production_task'])
      .order('changed_at', { ascending: false }),
    canViewInternalFinancials(context)
      ? supabase.rpc('finance_read_order_details', {
          target_enterprise_id: enterpriseId,
          target_order_id: orderId,
        })
      : Promise.resolve({ data: null, error: null }),
    hasEnterprisePermission(context, 'wages.read.all')
      ? supabase.rpc('wages_read_order_task_amounts', {
          target_enterprise_id: enterpriseId,
          target_order_id: orderId,
        })
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (spacesResult.error || productsResult.error || tasksResult.error || logsResult.error || financeResult.error || wagesResult.error) {
    console.error('order_detail.load_tree_failed', {
      spaces: spacesResult.error?.code,
      products: productsResult.error?.code,
      tasks: tasksResult.error?.code,
      logs: logsResult.error?.code,
      finance: financeResult.error?.code,
      wages: wagesResult.error?.code,
    });
    return { tree: null, failed: true };
  }

  const spaces = spacesResult.data || [];
  const financeDetails = financeResult.data as FinanceOrderDetail | null;
  const wageDetails = (wagesResult.data || []) as WageTaskDetail;
  const productFinance = new Map((financeDetails?.products || []).map((product) => [product.id, product]));
  const taskWages = new Map(wageDetails.map((task) => [task.id, task]));
  const products: SafeProductRow[] = (productsResult.data || []).map((product) => ({
    ...product,
    ...productFinance.get(product.id),
  }));
  const tasks: SafeTaskRow[] = (tasksResult.data || []).map((task) => ({
    ...task,
    ...taskWages.get(task.id),
  }));
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
      ...(financeDetails?.order || {}),
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.read');
    const { id } = await parseParams(params, paramsSchema);
    const supabase = await createClient();
    const { tree, failed } = await loadOrderDetail(supabase, context, id);
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
    const requestedInternalRemarkUpdate = body.internal_remark !== undefined;
    const requestedInternalUpdate = ['internal_remark', ...FINANCIAL_FIELDS]
      .some((field) => body[field as keyof typeof body] !== undefined);
    if (requestedInternalUpdate && !canUpdateInternalFinancials(context)) {
      return jsonError('无权修改内部字段', 403);
    }
    const requestedStatusUpdate = body.status !== undefined;
    const requestedDirectUpdate = body.customer_name !== undefined
      || PATCHABLE_STRING_FIELDS.some((field) => body[field] !== undefined)
      || (body.notes !== undefined && !requestedStatusUpdate && body.action === undefined);
    const updateCategoryCount = [
      requestedDirectUpdate,
      requestedFinancialUpdate,
      requestedInternalRemarkUpdate,
      requestedStatusUpdate,
    ].filter(Boolean).length;
    if (updateCategoryCount > 1) {
      return jsonError('财务、内部备注、状态和基础字段请分别提交', 422);
    }
    const supabase = await createClient();
    const { tree, failed } = await loadOrderDetail(supabase, context, id);
    if (failed) return jsonError('查询订单失败', 500);
    if (!tree) return jsonError('订单不存在', 404);

    if (body.action === 'withdraw_exchange' || body.status === 'withdrawn') {
      const { error: transitionError } = await supabase.rpc('transition_order_exchanges_for_order', {
        target_enterprise_id: context.enterpriseId,
        target_order_id: id,
        target_action: 'withdraw',
        target_message: typeof body.notes === 'string' ? body.notes : null,
      });
      if (transitionError) {
        console.error('order_detail.withdraw_exchange_failed', { code: transitionError.code });
        return jsonError(
          transitionError.code === 'P0002' ? '没有可撤回的订单流转'
            : transitionError.code === 'P0001' ? '订单流转状态已变化' : '撤回订单流转失败',
          transitionError.code === 'P0002' ? 400 : transitionError.code === 'P0001' ? 409 : 500,
        );
      }
      const refreshed = await loadOrderDetail(supabase, context, id);
      if (refreshed.failed) return jsonError('获取订单详情失败', 500);
      return Response.json({ success: true, data: sanitizeOrderDetail(context, refreshed.tree || tree) });
    }

    const updateData: OrderUpdate = { updated_at: new Date().toISOString() };
    if (typeof body.customer_name === 'string' && body.customer_name.trim()) updateData.customer_name = body.customer_name.trim();
    for (const field of PATCHABLE_STRING_FIELDS) setNullableStringField(updateData, body, field);
    if (typeof body.notes === 'string' && body.notes.trim() && !body.status && !body.action) {
      updateData.remark = body.notes.trim();
    }

    let requestedStatus: string | null = null;
    if (body.status !== undefined) {
      const nextStatus = String(body.status);
      if (!ORDER_STATUS_VALUES.includes(nextStatus as (typeof ORDER_STATUS_VALUES)[number])) {
        return jsonError(`无效订单状态: ${nextStatus}`, 400);
      }
      requestedStatus = nextStatus;
    }
    const hasDirectOrderUpdate = Object.keys(updateData).length > 1;
    if (!hasDirectOrderUpdate && !requestedFinancialUpdate && !requestedInternalRemarkUpdate && !requestedStatus) {
      return jsonError('没有可更新的订单字段', 400);
    }

    if (hasDirectOrderUpdate) {
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', id)
        .select(SAFE_ORDER_COLUMNS)
        .single();
      if (error || !data) {
        console.error('order_detail.update_failed', { code: error?.code });
        return jsonError('更新订单失败', 500);
      }
    }

    if (requestedInternalRemarkUpdate) {
      const { error } = await supabase.rpc('update_order_internal_remark' as never, {
        target_enterprise_id: context.enterpriseId,
        target_order_id: id,
        target_internal_remark: body.internal_remark ?? null,
      } as never);
      if (error) {
        console.error('order_detail.internal_remark_update_failed', { code: error.code });
        return jsonError('更新订单内部备注失败', error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 500);
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

    if (requestedStatus && requestedStatus !== tree.status) {
      const { error } = await supabase.rpc('transition_order_status_with_exchanges', {
        target_enterprise_id: context.enterpriseId,
        target_order_id: id,
        target_expected_status: tree.status,
        target_status: requestedStatus,
        target_remark: typeof body.notes === 'string' ? body.notes : null,
      } as never);
      if (error) {
        console.error('order_detail.status_update_failed', { code: error.code });
        return jsonError(
          error.code === 'P0001' ? '订单状态已变化' : '更新订单失败',
          error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 500,
        );
      }
    }

    const refreshed = await loadOrderDetail(supabase, context, id);
    if (refreshed.failed) return jsonError('获取订单详情失败', 500);
    return Response.json({ success: true, data: sanitizeOrderDetail(context, refreshed.tree || tree) });
  } catch (error) {
    return errorResponse(error, '更新订单失败');
  }
}
