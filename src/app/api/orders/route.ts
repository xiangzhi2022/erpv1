import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJson, parseQuery } from '@/lib/api/request';
import { isApiError } from '@/lib/api/errors';
import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';
import { ORDER_STATUSES, orderFormSchema, type OrderStats } from '@/app/orders/schemas';

const VALID_STATUSES = new Set<string>(ORDER_STATUSES);
const ORDER_FIELDS = 'id,order_no,enterprise_id,target_factory_id,dealer_id,order_flow,from_enterprise_id,to_enterprise_id,parent_order_id,customer_name,customer_phone,customer_address,status,total_amount,delivery_date,remark,created_by,created_at,updated_at';
const ITEM_FIELDS = 'id,enterprise_id,order_id,module_id,item_no,product_name,specifications,woodworking_craft,forming_craft,painting_craft,length_mm,width_mm,thickness_mm,quantity,unit,color,hardware,hardware_quantity,construction_surface,remark,sort_order,created_at,updated_at';
const MODULE_FIELDS = 'id,order_id,module_no,module_name,sort_order,remark,created_at,updated_at';
const ATTACHMENT_FIELDS = 'id,order_id,module_id,order_item_id,file_name,file_path,file_url,file_type,file_size,created_at,updated_at';
const orderQuerySchema = z.object({
  mode: z.enum(['dealer', 'factory_received', 'factory_material', 'supplier_received']).optional(),
  status: z.string().trim().max(200).optional(),
  search: z.string().trim().max(100).regex(/^[\p{L}\p{N}\s-]*$/u, '搜索关键词包含不支持的字符').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

type OrderRow = {
  id: string; order_no: string; enterprise_id: string; target_factory_id: string | null; dealer_id: string | null;
  order_flow: string; from_enterprise_id: string | null; to_enterprise_id: string | null; parent_order_id: string | null;
  customer_name: string; customer_phone: string | null; customer_address: string | null; status: string;
  total_amount: number | null; delivery_date: string | null; remark: string | null; created_by: string | null;
  created_at: string; updated_at: string; items?: OrderItemRow[];
};
type OrderItemRow = {
  id: string; enterprise_id: string; order_id: string; module_id: string | null; item_no: string | null; product_name: string;
  specifications: string | null; woodworking_craft: string | null; forming_craft: string | null; painting_craft: string | null;
  length_mm: number | null; width_mm: number | null; thickness_mm: number | null; quantity: number; unit: string;
  color: string | null; hardware: string | null; hardware_quantity: number | null; construction_surface: string | null;
  unit_price?: number; subtotal?: number;
  remark: string | null; sort_order: number; created_at: string; updated_at: string;
};
type OrderModuleRow = { id: string; order_id: string; module_no: string; module_name: string; sort_order: number; remark: string | null; created_at: string; updated_at: string };
type AttachmentRow = { id: string; order_id: string; module_id: string | null; order_item_id: string; file_name: string; file_path: string; file_url: string; file_type: string | null; file_size: number | null; created_at: string; updated_at: string };
type Client = Awaited<ReturnType<typeof createClient>>;
type AggregateOrderMode = 'dealer' | 'factory_received' | 'factory_material' | 'supplier_received';

function jsonError(error: string, status: number) { return NextResponse.json({ success: false, error }, { status }); }
function knownErrorResponse(error: unknown, fallback: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return jsonError(error.message, error.status);
  return jsonError(fallback, 500);
}
function emptyStats(): OrderStats { return { total: 0, pending: 0, returned: 0, confirmed: 0, pool: 0, producing: 0, shipped: 0, completed: 0, cancelled: 0 }; }

function orderTreeErrorResponse(error: { code?: string; message?: string }) {
  const message = error.message ?? '';
  if (error.code === '28000' || message === 'IDENTITY_REQUIRED') return jsonError('请先登录', 401);
  if (error.code === '42501') return jsonError('没有执行该操作的权限', 403);
  if (error.code === '23505' || message === 'ORDER_NUMBER_CONFLICT') return jsonError('订单号已存在，请重新生成', 409);
  if (message === 'ORDER_TREE_NOT_EMPTY') return jsonError('已有订单明细，暂不支持覆盖更新', 409);
  if (error.code === 'P0001') return jsonError('订单状态已变化，请刷新后重试', 409);
  if (message === 'ORDER_NOT_FOUND') return jsonError('订单不存在或无法更新', 404);
  if (error.code === 'P0002') return jsonError('关联订单或资源不存在', 400);
  if (error.code === '22023') return jsonError('订单数据无效', 400);
  return jsonError('创建订单失败', 500);
}

function statsFromRows(rows: { status: string }[]) {
  const stats = emptyStats();
  stats.total = rows.length;
  for (const row of rows) if (row.status in stats) stats[row.status as keyof OrderStats] += 1;
  return stats;
}

function visibleModesForEnterpriseType(enterpriseType: string): AggregateOrderMode[] {
  if (enterpriseType === 'manufacturer') return ['factory_received', 'factory_material'];
  if (enterpriseType === 'supplier') return ['supplier_received'];
  return ['dealer'];
}

function defaultModeForEnterpriseType(enterpriseType: string): AggregateOrderMode {
  if (enterpriseType === 'manufacturer') return 'factory_received';
  if (enterpriseType === 'supplier') return 'supplier_received';
  return 'dealer';
}

function modeConfig(mode: AggregateOrderMode) {
  return {
    dealer: { title: '经销商订单管理', description: '管理本企业创建的订单。', createLabel: '创建经销商订单', partnerLabel: '工厂企业', canCreate: true },
    factory_received: { title: '工厂企业订单管理', description: '管理本企业订单。', createLabel: null, partnerLabel: '经销商', canCreate: false },
    factory_material: { title: '材料采购单', description: '管理本企业创建的材料订单。', createLabel: '创建材料订单', partnerLabel: '材料商', canCreate: true },
    supplier_received: { title: '材料商订单管理', description: '管理本企业订单。', createLabel: null, partnerLabel: '工厂企业', canCreate: false },
  }[mode];
}

interface ScopedOrderQuery<T> {
  eq(column: string, value: string): T;
}

function applyModeScope<T extends ScopedOrderQuery<T>>(query: T, mode: AggregateOrderMode, enterpriseId: string): T {
  if (mode === 'dealer') return query.eq('order_flow', 'dealer_to_factory').eq('from_enterprise_id', enterpriseId);
  if (mode === 'factory_received') return query.eq('order_flow', 'dealer_to_factory').eq('to_enterprise_id', enterpriseId);
  if (mode === 'factory_material') return query.eq('order_flow', 'factory_to_supplier').eq('from_enterprise_id', enterpriseId);
  return query.eq('order_flow', 'factory_to_supplier').eq('to_enterprise_id', enterpriseId);
}

function toCompatibilityOrder(
  order: OrderRow,
  modules: OrderModuleRow[],
  attachments: AttachmentRow[],
  enterprises: Map<string, { id: string; name: string; code: string; enterprise_type: string }>,
  parents: Map<string, Pick<OrderRow, 'id' | 'order_no' | 'customer_name'>>,
) {
  const items = (order.items ?? []).map((item) => ({
    id: item.id, order_id: item.order_id, module_id: item.module_id, item_no: item.item_no,
    product_name: item.product_name, specifications: item.specifications, woodworking_craft: item.woodworking_craft,
    forming_craft: item.forming_craft, painting_craft: item.painting_craft, length_mm: item.length_mm,
    width_mm: item.width_mm, thickness_mm: item.thickness_mm, quantity: item.quantity, unit: item.unit,
    color: item.color, hardware: item.hardware, hardware_quantity: item.hardware_quantity,
    construction_surface: item.construction_surface,
    ...(item.unit_price !== undefined ? { unit_price: item.unit_price } : {}),
    ...(item.subtotal !== undefined ? { subtotal: item.subtotal } : {}),
    remark: item.remark, sort_order: item.sort_order, created_at: item.created_at, updated_at: item.updated_at,
    attachments: attachments.filter((attachment) => attachment.order_item_id === item.id).map((attachment) => ({
      id: attachment.id, order_id: attachment.order_id, module_id: attachment.module_id,
      order_item_id: attachment.order_item_id, file_name: attachment.file_name, file_path: attachment.file_path,
      file_url: attachment.file_url, file_type: attachment.file_type, file_size: attachment.file_size,
      created_at: attachment.created_at, updated_at: attachment.updated_at,
    })),
  })).sort((left, right) => left.sort_order - right.sort_order);
  return {
    id: order.id, order_no: order.order_no, enterprise_id: order.enterprise_id,
    target_factory_id: order.target_factory_id, dealer_id: order.dealer_id, order_flow: order.order_flow,
    from_enterprise_id: order.from_enterprise_id, to_enterprise_id: order.to_enterprise_id,
    parent_order_id: order.parent_order_id, customer_name: order.customer_name, customer_phone: order.customer_phone,
    customer_address: order.customer_address, status: order.status, total_amount: order.total_amount,
    delivery_date: order.delivery_date, remark: order.remark, created_by: order.created_by,
    created_at: order.created_at, updated_at: order.updated_at,
    // These are response-only compatibility keys; queries and mutations use enterprise columns.
    tenant_id: order.enterprise_id,
    from_tenant_id: order.from_enterprise_id,
    to_tenant_id: order.to_enterprise_id,
    items,
    modules: modules.filter((module) => module.order_id === order.id).map((module) => ({
      id: module.id, order_id: module.order_id, module_no: module.module_no, module_name: module.module_name,
      sort_order: module.sort_order, remark: module.remark, created_at: module.created_at, updated_at: module.updated_at,
      items: items.filter((item) => item.module_id === module.id),
      attachments: attachments.filter((attachment) => attachment.module_id === module.id).map((attachment) => ({
        id: attachment.id, order_id: attachment.order_id, module_id: attachment.module_id,
        order_item_id: attachment.order_item_id, file_name: attachment.file_name, file_path: attachment.file_path,
        file_url: attachment.file_url, file_type: attachment.file_type, file_size: attachment.file_size,
        created_at: attachment.created_at, updated_at: attachment.updated_at,
      })),
    })),
    from_tenant: order.from_enterprise_id ? enterprises.get(order.from_enterprise_id) ?? null : null,
    to_tenant: order.to_enterprise_id ? enterprises.get(order.to_enterprise_id) ?? null : null,
    parent_order: order.parent_order_id ? parents.get(order.parent_order_id) ?? null : null,
  };
}

async function hydrateOrders(supabase: Client, enterpriseId: string, orders: OrderRow[]) {
  const orderIds = orders.map((order) => order.id);
  if (orderIds.length === 0) return [];
  const enterpriseIds = [...new Set(orders.flatMap((order) => [order.from_enterprise_id, order.to_enterprise_id]).filter(Boolean))] as string[];
  const parentIds = [...new Set(orders.map((order) => order.parent_order_id).filter(Boolean))] as string[];
  const [modulesResult, attachmentsResult, enterprisesResult, parentsResult] = await Promise.all([
    supabase.from('order_modules').select(MODULE_FIELDS).eq('enterprise_id', enterpriseId).in('order_id', orderIds).order('sort_order'),
    supabase.from('order_item_attachments').select(ATTACHMENT_FIELDS).eq('enterprise_id', enterpriseId).in('order_id', orderIds),
    enterpriseIds.length ? supabase.from('enterprises').select('id,name,code,enterprise_type').in('id', enterpriseIds) : Promise.resolve({ data: [], error: null }),
    parentIds.length ? supabase.from('orders').select('id,order_no,customer_name').eq('enterprise_id', enterpriseId).in('id', parentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (modulesResult.error || attachmentsResult.error || enterprisesResult.error || parentsResult.error) throw new Error('order hydration failed');
  const enterprises = new Map(((enterprisesResult.data ?? []) as { id: string; name: string; code: string; enterprise_type: string }[]).map((enterprise) => [enterprise.id, enterprise]));
  const parents = new Map(((parentsResult.data ?? []) as Pick<OrderRow, 'id' | 'order_no' | 'customer_name'>[]).map((parent) => [parent.id, parent]));
  return orders.map((order) => toCompatibilityOrder(order, (modulesResult.data ?? []) as OrderModuleRow[], (attachmentsResult.data ?? []) as AttachmentRow[], enterprises, parents));
}

export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.read');
    const input = parseQuery(request, orderQuerySchema);
    const supabase = await createClient();
    const visibleModes = visibleModesForEnterpriseType(context.enterpriseType);
    const mode = input.mode && visibleModes.includes(input.mode)
      ? input.mode
      : defaultModeForEnterpriseType(context.enterpriseType);
    if (input.mode && !visibleModes.includes(input.mode)) return jsonError('无权限访问该订单模块', 403);
    let query = applyModeScope(
      supabase.from('orders').select(`${ORDER_FIELDS},items:order_items(${ITEM_FIELDS})`, { count: 'exact' })
        .eq('enterprise_id', context.enterpriseId),
      mode,
      context.enterpriseId,
    ).order('created_at', { ascending: false }).range((input.page - 1) * input.pageSize, input.page * input.pageSize - 1);
    if (input.status && input.status !== 'all') {
      const statuses = input.status.split(',').map((entry) => entry.trim()).filter(Boolean);
      if (statuses.some((entry) => !VALID_STATUSES.has(entry))) return jsonError('订单状态筛选值无效', 400);
      query = statuses.length === 1 ? query.eq('status', statuses[0]) : query.in('status', statuses);
    }
    if (input.search) query = query.or(`order_no.ilike.%${input.search}%,customer_name.ilike.%${input.search}%`);
    const statsQuery = applyModeScope(
      supabase.from('orders').select('status').eq('enterprise_id', context.enterpriseId),
      mode,
      context.enterpriseId,
    );
    const [{ data, error, count }, statsResult] = await Promise.all([query, statsQuery]);
    if (error || statsResult.error) {
      console.error('orders.list_failed', { code: error?.code ?? statsResult.error?.code });
      return jsonError('获取订单失败', 500);
    }
    const orderRows = (data ?? []) as OrderRow[];
    const orderIds = orderRows.map((order) => order.id);
    const amountResult = hasEnterprisePermission(context, 'finance.read') && orderIds.length > 0
      ? await supabase.rpc('finance_list_order_item_amounts', {
          target_enterprise_id: context.enterpriseId,
          target_order_ids: orderIds,
        })
      : { data: [], error: null };
    if (amountResult.error) {
      console.error('orders.item_amounts_failed', { code: amountResult.error.code });
      return jsonError('获取订单价格失败', 500);
    }
    const itemAmounts = new Map(
      (amountResult.data ?? []).map((amount) => [amount.id, amount]),
    );
    const enrichedRows = orderRows.map((order) => ({
      ...order,
      items: (order.items ?? []).map((item) => {
        const amount = itemAmounts.get(item.id);
        return amount
          ? { ...item, unit_price: amount.unit_price, subtotal: amount.subtotal }
          : item;
      }),
    }));
    const orders = await hydrateOrders(supabase, context.enterpriseId, enrichedRows);
    const config = modeConfig(mode);
    return NextResponse.json({
      success: true, data: orders,
      pagination: { page: input.page, pageSize: input.pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / input.pageSize) },
      stats: statsFromRows((statsResult.data ?? []) as { status: string }[]),
      context: {
        mode, visibleModes, canCreate: config.canCreate && context.grants.has('orders.create'),
        title: config.title, description: config.description, createLabel: config.createLabel, partnerLabel: config.partnerLabel,
        currentUser: { id: context.userId, name: context.displayName, phone: null, role: null, tenant_id: context.enterpriseId, tenant_type: context.enterpriseType },
      },
    });
  } catch (error) {
    console.error('orders.list_failed', { error });
    return knownErrorResponse(error, '获取订单失败');
  }
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    const values = await parseJson(request, orderFormSchema);
    const { existing_order_id: existingOrderId, ...targetOrder } = values;
    const updating = Boolean(existingOrderId);

    requirePermission(context, updating ? 'orders.update' : 'orders.create');
    if (updating) requirePermission(context, 'finance.manage');
    if (!updating) requirePermission(context, 'orders.update');

    const hasTasks = values.modules.some((module) =>
      module.items.some((item) => item.tasks.length > 0)
    );
    if (hasTasks) {
      requirePermission(context, 'production.plan');
      requirePermission(context, 'production.manage');
    }
    const hasAttachments = values.modules.some((module) =>
      module.items.some((item) =>
        item.attachments.length > 0
        || item.tasks.some((task) => task.attachments.length > 0)
      )
    );
    if (hasAttachments) requirePermission(context, 'attachments.manage');

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('save_order_tree' as never, {
      target_enterprise_id: context.enterpriseId,
      target_existing_order_id: existingOrderId || null,
      target_order: targetOrder,
    } as never);

    if (error) {
      console.error('orders.save_tree_failed', { code: error.code });
      return orderTreeErrorResponse(error);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return jsonError('创建订单失败', 500);
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('orders.create_failed', { error });
    return knownErrorResponse(error, '创建订单失败');
  }
}
