import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJson, parseQuery } from '@/lib/api/request';
import { isApiError } from '@/lib/api/errors';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';
import { ORDER_STATUSES, orderFormSchema, type OrderStats } from '@/app/orders/schemas';

const VALID_STATUSES = new Set<string>(ORDER_STATUSES);
const ORDER_FIELDS = 'id,order_no,enterprise_id,target_factory_id,dealer_id,order_flow,from_enterprise_id,to_enterprise_id,parent_order_id,customer_name,customer_phone,customer_address,status,total_amount,delivery_date,remark,created_by,created_at,updated_at';
const ITEM_FIELDS = 'id,order_id,module_id,item_no,product_name,specifications,woodworking_craft,forming_craft,painting_craft,length_mm,width_mm,thickness_mm,quantity,unit,color,hardware,hardware_quantity,construction_surface,unit_price,subtotal,remark,sort_order,created_at,updated_at';
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
  id: string; order_id: string; module_id: string | null; item_no: string | null; product_name: string;
  specifications: string | null; woodworking_craft: string | null; forming_craft: string | null; painting_craft: string | null;
  length_mm: number | null; width_mm: number | null; thickness_mm: number | null; quantity: number; unit: string;
  color: string | null; hardware: string | null; hardware_quantity: number | null; construction_surface: string | null;
  unit_price: number; subtotal: number; remark: string | null; sort_order: number; created_at: string; updated_at: string;
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
function yuanToCents(value: number) { return Math.round((Number(value) || 0) * 100); }
function nullableText(value: string | undefined | null) { return value?.trim() || null; }

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

function expectedOrderFlow(enterpriseType: string): 'dealer_to_factory' | 'factory_to_supplier' | null {
  if (enterpriseType === 'dealer') return 'dealer_to_factory';
  if (enterpriseType === 'manufacturer') return 'factory_to_supplier';
  return null;
}

function expectedRecipientType(orderFlow: 'dealer_to_factory' | 'factory_to_supplier') {
  return orderFlow === 'dealer_to_factory' ? 'manufacturer' : 'supplier';
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
    construction_surface: item.construction_surface, unit_price: item.unit_price, subtotal: item.subtotal,
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

async function deleteOrderChildren(supabase: Client, enterpriseId: string, orderId: string) {
  const tables = [
    'order_item_attachments',
    'production_tasks',
    'order_products',
    'order_spaces',
    'order_items',
    'order_modules',
  ] as const;
  for (const table of tables) {
    const { error } = await supabase.from(table).delete()
      .eq('enterprise_id', enterpriseId)
      .eq('order_id', orderId);
    if (error) throw new Error('order child cleanup failed');
  }
}

async function hasExistingOrderChildren(supabase: Client, enterpriseId: string, orderId: string) {
  const results = await Promise.all([
    supabase.from('order_modules').select('id').eq('enterprise_id', enterpriseId).eq('order_id', orderId).limit(1),
    supabase.from('order_items').select('id').eq('enterprise_id', enterpriseId).eq('order_id', orderId).limit(1),
    supabase.from('order_spaces').select('id').eq('enterprise_id', enterpriseId).eq('order_id', orderId).limit(1),
    supabase.from('order_products').select('id').eq('enterprise_id', enterpriseId).eq('order_id', orderId).limit(1),
    supabase.from('production_tasks').select('id').eq('enterprise_id', enterpriseId).eq('order_id', orderId).limit(1),
    supabase.from('order_item_attachments').select('id').eq('enterprise_id', enterpriseId).eq('order_id', orderId).limit(1),
  ]);
  if (results.some((result) => result.error)) throw new Error('order child preflight failed');
  return results.some((result) => (result.data?.length ?? 0) > 0);
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
    const orders = await hydrateOrders(supabase, context.enterpriseId, (data ?? []) as OrderRow[]);
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
    const updating = Boolean(values.existing_order_id);
    requirePermission(context, updating ? 'orders.update' : 'orders.create');
    if (!updating) requirePermission(context, 'orders.update');
    const hasTasks = values.modules.some((module) => module.items.some((item) => item.tasks.length > 0));
    if (hasTasks) {
      requirePermission(context, 'production.plan');
      requirePermission(context, 'production.manage');
    }
    const hasAttachments = values.modules.some((module) => module.items.some((item) => (
      item.attachments.length > 0 || item.tasks.some((task) => task.attachments.length > 0)
    )));
    if (hasAttachments) requirePermission(context, 'attachments.manage');
    const allowedFlow = expectedOrderFlow(context.enterpriseType);
    if (!allowedFlow || values.order_flow !== allowedFlow) return jsonError('当前企业不能创建该类型订单', 403);
    const supabase = await createClient();
    const recipientEnterpriseId = values.to_tenant_id || null;
    if (!recipientEnterpriseId) return jsonError('接收企业不能为空', 400);
    const { data: recipient, error: recipientError } = await supabase.from('enterprises')
      .select('id,enterprise_type,status').eq('id', recipientEnterpriseId).maybeSingle();
    if (recipientError || !recipient || recipient.status !== 'active' || recipient.enterprise_type !== expectedRecipientType(values.order_flow)) {
      return jsonError('接收企业不可用或类型不匹配', 400);
    }
    const targetFactoryId = values.order_flow === 'dealer_to_factory' ? recipientEnterpriseId : context.enterpriseId;
    if (values.target_factory_id && values.target_factory_id !== targetFactoryId) return jsonError('目标工厂与订单流转不一致', 400);
    if (values.parent_order_id) {
      let parentQuery = supabase.from('orders').select('id,to_enterprise_id,target_factory_id,order_flow')
        .eq('enterprise_id', context.enterpriseId).eq('id', values.parent_order_id);
      if (values.order_flow === 'factory_to_supplier') {
        parentQuery = parentQuery.eq('order_flow', 'dealer_to_factory').eq('to_enterprise_id', context.enterpriseId);
      }
      const { data: parent, error } = await parentQuery.maybeSingle();
      if (error || !parent) return jsonError('关联订单不存在', 400);
    }
    let duplicateQuery = supabase.from('orders').select('id').eq('enterprise_id', context.enterpriseId).eq('order_no', values.order_no.trim());
    if (values.existing_order_id) duplicateQuery = duplicateQuery.neq('id', values.existing_order_id);
    const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
    if (duplicateError) return jsonError('订单校验失败', 500);
    if (duplicate) return jsonError('订单号已存在，请重新生成', 409);
    const totalAmount = values.modules.reduce((sum, module) => sum + module.items.reduce((itemTotal, item) => itemTotal + yuanToCents(item.unit_price) * Number(item.quantity), 0), 0);
    const orderPayload = {
      enterprise_id: context.enterpriseId, order_no: values.order_no.trim(), customer_name: values.customer_name.trim(), customer_phone: nullableText(values.customer_phone), customer_address: nullableText(values.customer_address),
      status: 'pending', total_amount: totalAmount, delivery_date: values.delivery_date || null, remark: nullableText(values.remark), target_factory_id: targetFactoryId,
      dealer_id: values.order_flow === 'dealer_to_factory' ? context.enterpriseId : null, order_flow: values.order_flow,
      from_enterprise_id: context.enterpriseId, to_enterprise_id: recipientEnterpriseId, parent_order_id: values.parent_order_id || null, updated_at: new Date().toISOString(),
    };
    let order: OrderRow;
    if (values.existing_order_id) {
      if (await hasExistingOrderChildren(supabase, context.enterpriseId, values.existing_order_id)) {
        return jsonError('已有订单明细，暂不支持覆盖更新', 409);
      }
      const { data, error } = await supabase.from('orders').update(orderPayload).eq('enterprise_id', context.enterpriseId).eq('id', values.existing_order_id).select(ORDER_FIELDS).maybeSingle();
      if (error || !data) return jsonError('订单不存在或无法更新', 404);
      order = data as OrderRow;
    } else {
      const { data, error } = await supabase.from('orders').insert({ ...orderPayload, created_by: context.userId }).select(ORDER_FIELDS).single();
      if (error || !data) return jsonError('创建订单失败', 500);
      order = data as OrderRow;
    }
    try {
      const modules = values.modules.map((module, moduleIndex) => ({ enterprise_id: context.enterpriseId, order_id: order.id, module_no: `${values.order_no.trim()}-M${String(moduleIndex + 1).padStart(2, '0')}`, module_name: module.module_name.trim(), sort_order: moduleIndex + 1, remark: nullableText(module.remark), updated_at: new Date().toISOString() }));
      const { data: createdModules, error: modulesError } = await supabase.from('order_modules').insert(modules).select(MODULE_FIELDS);
      if (modulesError || !createdModules) throw new Error('module insert failed');
      const modulesByNo = new Map((createdModules as OrderModuleRow[]).map((module) => [module.module_no, module]));
      const items = values.modules.flatMap((module, moduleIndex) => {
        const moduleNo = `${values.order_no.trim()}-M${String(moduleIndex + 1).padStart(2, '0')}`;
        const createdModule = modulesByNo.get(moduleNo);
        if (!createdModule) return [];
        return module.items.map((item, itemIndex) => {
          const unitPrice = yuanToCents(item.unit_price); const quantity = Number(item.quantity);
          return { enterprise_id: context.enterpriseId, order_id: order.id, module_id: createdModule.id, item_no: `${moduleNo}-I${String(itemIndex + 1).padStart(2, '0')}`, product_name: item.product_name.trim(), specifications: nullableText(item.specification), woodworking_craft: nullableText(item.woodworking_craft), forming_craft: nullableText(item.forming_craft), painting_craft: nullableText(item.painting_craft), length_mm: item.length_mm ?? null, width_mm: item.width_mm ?? null, thickness_mm: item.thickness_mm ?? null, quantity, unit: item.unit, color: nullableText(item.color), hardware: nullableText(item.hardware), hardware_quantity: item.hardware_quantity ?? null, construction_surface: nullableText(item.construction_surface), unit_price: unitPrice, subtotal: unitPrice * quantity, remark: nullableText(item.remark), sort_order: itemIndex + 1, updated_at: new Date().toISOString() };
        });
      });
      const { data: createdItems, error: itemsError } = await supabase.from('order_items').insert(items).select(ITEM_FIELDS);
      if (itemsError || !createdItems) throw new Error('item insert failed');
      const itemsByNo = new Map((createdItems as OrderItemRow[]).map((item) => [item.item_no, item]));
      const spaces = values.modules.map((module, moduleIndex) => ({
        enterprise_id: context.enterpriseId, order_id: order.id,
        space_no: `${values.order_no.trim()}-S${String(moduleIndex + 1).padStart(2, '0')}`,
        space_name: module.module_name.trim(), space_type: 'custom', sort_order: moduleIndex + 1,
        status: 'draft', remark: nullableText(module.remark), updated_at: new Date().toISOString(),
      }));
      const { data: createdSpaces, error: spacesError } = await supabase.from('order_spaces').insert(spaces).select('id,space_no');
      if (spacesError || !createdSpaces) throw new Error('space insert failed');
      const spacesByNo = new Map((createdSpaces as { id: string; space_no: string }[]).map((space) => [space.space_no, space]));
      const products = values.modules.flatMap((module, moduleIndex) => {
        const spaceNo = `${values.order_no.trim()}-S${String(moduleIndex + 1).padStart(2, '0')}`;
        const createdSpace = spacesByNo.get(spaceNo);
        if (!createdSpace) return [];
        return module.items.map((item, itemIndex) => {
          const unitPrice = yuanToCents(item.unit_price);
          const quantity = Number(item.quantity);
          return {
            enterprise_id: context.enterpriseId, order_id: order.id, space_id: createdSpace.id,
            product_no: `${spaceNo}-P${String(itemIndex + 1).padStart(2, '0')}`,
            product_name: item.product_name.trim(), product_type: item.product_type || (item.hardware ? 'hardware' : 'custom'),
            width: item.width_mm ?? null, height: item.length_mm ?? null, depth: item.thickness_mm ?? null,
            quantity, material: nullableText(item.material) || nullableText(item.specification), color: nullableText(item.color),
            status: 'draft', quoted_amount: unitPrice * quantity, sort_order: itemIndex + 1,
            remark: nullableText(item.remark), updated_at: new Date().toISOString(),
          };
        });
      });
      const { data: createdProducts, error: productsError } = products.length
        ? await supabase.from('order_products').insert(products).select('id,product_no,space_id')
        : { data: [], error: null };
      if (productsError) throw new Error('product insert failed');
      const productsByNo = new Map(((createdProducts ?? []) as { id: string; product_no: string; space_id: string }[]).map((product) => [product.product_no, product]));
      const tasks = values.modules.flatMap((module, moduleIndex) => {
        const spaceNo = `${values.order_no.trim()}-S${String(moduleIndex + 1).padStart(2, '0')}`;
        const createdSpace = spacesByNo.get(spaceNo);
        if (!createdSpace) return [];
        return module.items.flatMap((item, itemIndex) => {
          const productNo = `${spaceNo}-P${String(itemIndex + 1).padStart(2, '0')}`;
          const createdProduct = productsByNo.get(productNo);
          if (!createdProduct) return [];
          return item.tasks.map((task, taskIndex) => ({
            enterprise_id: context.enterpriseId, order_id: order.id, space_id: createdSpace.id, product_id: createdProduct.id,
            task_no: `${productNo}-T${String(taskIndex + 1).padStart(2, '0')}`, task_type: task.task_type,
            task_name: task.task_name.trim(), task_code: nullableText(task.task_code), product_name: item.product_name.trim(),
            quantity: Number(task.quantity), unit: task.unit || item.unit, length: task.length_mm ?? item.length_mm ?? null,
            width: task.width_mm ?? item.width_mm ?? null, thickness: task.thickness_mm ?? item.thickness_mm ?? null,
            area: task.area ?? null, material: nullableText(task.material) || nullableText(item.material) || nullableText(item.specification),
            color: nullableText(task.color) || nullableText(item.color), process_name: nullableText(task.process_name),
            status: 'pending_generate', remark: nullableText(task.remark), updated_at: new Date().toISOString(),
          }));
        });
      });
      if (tasks.length) {
        const { error } = await supabase.from('production_tasks').insert(tasks);
        if (error) throw new Error('task insert failed');
      }
      const attachments = values.modules.flatMap((module, moduleIndex) => {
        const moduleNo = `${values.order_no.trim()}-M${String(moduleIndex + 1).padStart(2, '0')}`;
        const createdModule = modulesByNo.get(moduleNo);
        if (!createdModule) return [];
        return module.items.flatMap((item, itemIndex) => {
          const createdItem = itemsByNo.get(`${moduleNo}-I${String(itemIndex + 1).padStart(2, '0')}`);
          if (!createdItem) return [];
          return [...item.attachments, ...item.tasks.flatMap((task) => task.attachments)].map((attachment) => ({ enterprise_id: context.enterpriseId, order_id: order.id, module_id: createdModule.id, order_item_id: createdItem.id, file_name: attachment.file_name, file_path: attachment.file_path, file_url: attachment.file_url, file_type: attachment.file_type ?? null, file_size: attachment.file_size ?? null, uploaded_by: context.userId }));
        });
      });
      if (attachments.length) {
        const { error } = await supabase.from('order_item_attachments').insert(attachments);
        if (error) throw new Error('attachment insert failed');
      }
      const { data: fullOrder, error: fullOrderError } = await supabase.from('orders').select(`${ORDER_FIELDS},items:order_items(${ITEM_FIELDS})`).eq('enterprise_id', context.enterpriseId).eq('id', order.id).single();
      if (fullOrderError || !fullOrder) throw new Error('order read failed');
      const hydrated = await hydrateOrders(supabase, context.enterpriseId, [fullOrder as OrderRow]);
      return NextResponse.json({ success: true, data: hydrated[0] ?? fullOrder });
    } catch (error) {
      try {
        await deleteOrderChildren(supabase, context.enterpriseId, order.id);
      } catch (cleanupError) {
        console.error('orders.cleanup_failed', { cleanupError });
      }
      throw error;
    }
  } catch (error) {
    console.error('orders.create_failed', { error });
    return knownErrorResponse(error, '创建订单失败');
  }
}
