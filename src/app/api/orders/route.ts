import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest, type AuthUser } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';
import {
  ORDER_MODE_CONFIG,
  canCreateOrderInMode,
  getVisibleOrderModes,
  normalizeOrderMode,
  type OrderFlow,
  type OrderMode,
} from '@/lib/order-flow';
import { ORDER_STATUSES, orderFormSchema, type OrderStats } from '@/app/orders/schemas';

const VALID_STATUSES = new Set<string>(ORDER_STATUSES);

interface TenantRow {
  id: string;
  name: string | null;
  company_name: string | null;
  tenant_type: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  status?: string | null;
}

interface OrderRow {
  id: string;
  order_no: string;
  tenant_id: string | null;
  target_factory_id: string | null;
  dealer_id: string | null;
  order_flow: OrderFlow | null;
  from_tenant_id: string | null;
  to_tenant_id: string | null;
  parent_order_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  status: string;
  total_amount: string | number | null;
  delivery_date: string | null;
  remark: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string | null;
  items?: OrderItemRow[];
}

interface OrderModuleRow {
  id: string;
  order_id: string;
  module_no: string;
  module_name: string;
  sort_order: number;
  remark: string | null;
  created_at: string;
  updated_at: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  module_id: string | null;
  item_no: string | null;
  product_name: string;
  specifications: string | null;
  woodworking_craft: string | null;
  forming_craft: string | null;
  painting_craft: string | null;
  length_mm: string | number | null;
  width_mm: string | number | null;
  thickness_mm: string | number | null;
  quantity: string | number;
  unit: string | null;
  color: string | null;
  hardware: string | null;
  hardware_quantity: string | number | null;
  construction_surface: string | null;
  unit_price: string | number;
  subtotal: string | number;
  remark: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string | null;
}

interface AttachmentRow {
  id: string;
  order_id: string;
  module_id: string | null;
  order_item_id: string;
  tenant_id: string | null;
  file_name: string;
  file_path: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function emptyStats(): OrderStats {
  return {
    total: 0,
    pending: 0,
    returned: 0,
    confirmed: 0,
    pool: 0,
    producing: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
  };
}

interface ScopedQuery<T> {
  eq(column: string, value: string): T;
  in(column: string, values: readonly string[]): T;
}

function applyModeScope<T extends ScopedQuery<T>>(query: T, user: AuthUser, mode: OrderMode): T {
  if (mode === 'dealer') {
    query = query.in('order_flow', ['dealer_to_factory', 'legacy']);
    if (!isSuperAdmin(user)) query = query.eq('from_tenant_id', user.tenant_id || '');
  } else if (mode === 'factory_received') {
    query = query.eq('order_flow', 'dealer_to_factory');
    if (!isSuperAdmin(user)) query = query.eq('to_tenant_id', user.tenant_id || '');
  } else if (mode === 'factory_material') {
    query = query.eq('order_flow', 'factory_to_supplier');
    if (!isSuperAdmin(user)) query = query.eq('from_tenant_id', user.tenant_id || '');
  } else {
    query = query.eq('order_flow', 'factory_to_supplier');
    if (!isSuperAdmin(user)) query = query.eq('to_tenant_id', user.tenant_id || '');
  }
  return query;
}

async function hydrateOrders(supabase: ReturnType<typeof getSupabaseClient>, rows: OrderRow[]) {
  const orderIds = rows.map((order) => order.id);
  if (orderIds.length === 0) return [];

  const tenantIds = new Set<string>();
  const parentIds = new Set<string>();
  rows.forEach((order) => {
    if (order.from_tenant_id) tenantIds.add(order.from_tenant_id);
    if (order.to_tenant_id) tenantIds.add(order.to_tenant_id);
    if (order.parent_order_id) parentIds.add(order.parent_order_id);
  });

  const [modulesRes, attachmentsRes, tenantsRes, parentsRes] = await Promise.all([
    supabase.from('order_modules').select('*').in('order_id', orderIds).order('sort_order', { ascending: true }),
    supabase.from('order_item_attachments').select('*').in('order_id', orderIds),
    tenantIds.size > 0
      ? supabase.from('tenants').select('id, name, company_name, tenant_type, contact_person, contact_phone, address, status').in('id', Array.from(tenantIds))
      : Promise.resolve({ data: [] as TenantRow[], error: null }),
    parentIds.size > 0
      ? supabase.from('orders').select('id, order_no, customer_name').in('id', Array.from(parentIds))
      : Promise.resolve({ data: [] as Pick<OrderRow, 'id' | 'order_no' | 'customer_name'>[], error: null }),
  ]);

  if (modulesRes.error) throw new Error(modulesRes.error.message);
  if (attachmentsRes.error) throw new Error(attachmentsRes.error.message);
  if (tenantsRes.error) throw new Error(tenantsRes.error.message);
  if (parentsRes.error) throw new Error(parentsRes.error.message);

  const modules = (modulesRes.data || []) as OrderModuleRow[];
  const attachments = (attachmentsRes.data || []) as AttachmentRow[];
  const tenants = (tenantsRes.data || []) as TenantRow[];
  const parents = (parentsRes.data || []) as Pick<OrderRow, 'id' | 'order_no' | 'customer_name'>[];

  const moduleMap = new Map<string, OrderModuleRow[]>();
  modules.forEach((module) => {
    const list = moduleMap.get(module.order_id) || [];
    list.push(module);
    moduleMap.set(module.order_id, list);
  });

  const attachmentByItem = new Map<string, AttachmentRow[]>();
  attachments.forEach((attachment) => {
    const list = attachmentByItem.get(attachment.order_item_id) || [];
    list.push(attachment);
    attachmentByItem.set(attachment.order_item_id, list);
  });

  const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const parentMap = new Map(parents.map((parent) => [parent.id, parent]));

  return rows.map((order) => {
    const items = (order.items || [])
      .map((item) => ({ ...item, attachments: attachmentByItem.get(item.id) || [] }))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const orderModules = (moduleMap.get(order.id) || []).map((module) => ({
      ...module,
      items: items.filter((item) => item.module_id === module.id),
      attachments: attachments.filter((attachment) => attachment.module_id === module.id),
    }));

    return {
      ...order,
      items,
      modules: orderModules,
      from_tenant: order.from_tenant_id ? tenantMap.get(order.from_tenant_id) || null : null,
      to_tenant: order.to_tenant_id ? tenantMap.get(order.to_tenant_id) || null : null,
      parent_order: order.parent_order_id ? parentMap.get(order.parent_order_id) || null : null,
    };
  });
}

function statsFromRows(rows: { status: string }[]): OrderStats {
  const stats = emptyStats();
  stats.total = rows.length;
  rows.forEach((row) => {
    if (row.status in stats) stats[row.status as keyof OrderStats] += 1;
  });
  return stats;
}

function yuanToCents(value: number): number {
  return Math.round((Number(value) || 0) * 100);
}

function nullableText(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const mode = normalizeOrderMode(searchParams.get('mode'), user);
    if (!mode) return jsonError('无权限访问该订单模块', 403);

    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '20', 10)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (!isSuperAdmin(user) && !user.tenant_id) return jsonError('当前用户未关联企业', 403);

    let query = supabase
      .from('orders')
      .select('*, items:order_items(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    query = applyModeScope(query, user, mode);

    if (status && status !== 'all') {
      const statuses = status.split(',').map((item) => item.trim()).filter(Boolean);
      if (statuses.some((item) => !VALID_STATUSES.has(item))) return jsonError('订单状态筛选值无效', 400);
      query = statuses.length === 1 ? query.eq('status', statuses[0]) : query.in('status', statuses);
    }

    if (search) {
      query = query.or(`order_no.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    let statsQuery = supabase.from('orders').select('status');
    statsQuery = applyModeScope(statsQuery, user, mode);
    const { data: statsRows, error: statsError } = await statsQuery;
    if (statsError) return jsonError(statsError.message, 500);

    const orders = await hydrateOrders(supabase, (data || []) as OrderRow[]);
    const config = ORDER_MODE_CONFIG[mode];
    const visibleModes = getVisibleOrderModes(user);

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      stats: statsFromRows((statsRows || []) as { status: string }[]),
      context: {
        mode,
        visibleModes,
        canCreate: canCreateOrderInMode(user, mode),
        title: config.title,
        description: config.description,
        createLabel: config.createLabel,
        partnerLabel: config.partnerLabel,
      },
    });
  } catch (error) {
    console.error('get orders failed:', error);
    return jsonError('获取订单失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!user.tenant_id) return jsonError('当前用户未关联企业', 403);

    const parsed = orderFormSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message || '订单数据无效', 400);
    }

    const values = parsed.data;
    const mode: OrderMode = values.order_flow === 'dealer_to_factory' ? 'dealer' : 'factory_material';
    if (!canCreateOrderInMode(user, mode)) return jsonError('无权限创建该类型订单', 403);

    const expectedTenantType = values.order_flow === 'dealer_to_factory' ? 'manufacturer' : 'material_supplier';
    const supabase = getSupabaseClient();

    const { data: toTenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, company_name, tenant_type, contact_phone, status')
      .eq('id', values.to_tenant_id)
      .eq('tenant_type', expectedTenantType)
      .eq('status', 'active')
      .maybeSingle();

    if (tenantError) return jsonError(tenantError.message, 500);
    if (!toTenant) return jsonError('接收企业不存在或类型不正确', 400);

    if (values.parent_order_id) {
      const { data: parentOrder, error: parentError } = await supabase
        .from('orders')
        .select('id, to_tenant_id, target_factory_id, order_flow')
        .eq('id', values.parent_order_id)
        .maybeSingle();
      if (parentError) return jsonError(parentError.message, 500);
      if (!parentOrder) return jsonError('关联经销商订单不存在', 400);
      const parentReceiver = parentOrder.to_tenant_id || parentOrder.target_factory_id;
      if (!isSuperAdmin(user) && parentReceiver !== user.tenant_id) {
        return jsonError('只能关联本工厂接收的经销商订单', 403);
      }
    }

    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('order_no', values.order_no.trim())
      .maybeSingle();
    if (existing) return jsonError('订单号已存在，请重新生成', 409);

    let totalAmount = 0;
    values.modules.forEach((module) => {
      module.items.forEach((item) => {
        totalAmount += yuanToCents(item.unit_price) * Number(item.quantity || 1);
      });
    });

    const receiverName = toTenant.company_name || toTenant.name || values.customer_name;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_no: values.order_no.trim(),
        customer_name: values.customer_name.trim(),
        customer_phone: values.customer_phone?.trim() || null,
        status: 'pending',
        total_amount: totalAmount,
        delivery_date: values.delivery_date || null,
        remark: nullableText(values.remark),
        tenant_id: user.tenant_id,
        target_factory_id: values.to_tenant_id,
        dealer_id: values.order_flow === 'dealer_to_factory' ? user.tenant_id : null,
        order_flow: values.order_flow,
        from_tenant_id: user.tenant_id,
        to_tenant_id: values.to_tenant_id,
        parent_order_id: values.parent_order_id || null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError || !order) return jsonError(orderError?.message || '创建订单失败', 500);

    try {
      const moduleInserts = values.modules.map((module, moduleIndex) => ({
        order_id: order.id,
        module_no: `${values.order_no.trim()}-M${String(moduleIndex + 1).padStart(2, '0')}`,
        module_name: module.module_name.trim(),
        sort_order: moduleIndex + 1,
        remark: nullableText(module.remark),
        updated_at: new Date().toISOString(),
      }));

      const { data: insertedModules, error: moduleError } = await supabase
        .from('order_modules')
        .insert(moduleInserts)
        .select();
      if (moduleError) throw new Error(moduleError.message);

      const modules = insertedModules as OrderModuleRow[];
      const moduleByNo = new Map(modules.map((module) => [module.module_no, module]));
      const itemInserts = values.modules.flatMap((module, moduleIndex) => {
        const moduleNo = `${values.order_no.trim()}-M${String(moduleIndex + 1).padStart(2, '0')}`;
        const insertedModule = moduleByNo.get(moduleNo);
        if (!insertedModule) return [];

        return module.items.map((item, itemIndex) => {
          const unitPrice = yuanToCents(item.unit_price);
          const quantity = Number(item.quantity || 1);
          return {
            order_id: order.id,
            module_id: insertedModule.id,
            item_no: `${moduleNo}-I${String(itemIndex + 1).padStart(2, '0')}`,
            product_name: item.product_name.trim(),
            specifications: nullableText(item.specification),
            woodworking_craft: nullableText(item.woodworking_craft),
            forming_craft: nullableText(item.forming_craft),
            painting_craft: nullableText(item.painting_craft),
            length_mm: item.length_mm ?? null,
            width_mm: item.width_mm ?? null,
            thickness_mm: item.thickness_mm ?? null,
            quantity,
            unit: item.unit || '件',
            color: nullableText(item.color),
            hardware: nullableText(item.hardware),
            hardware_quantity: item.hardware_quantity ?? null,
            construction_surface: nullableText(item.construction_surface),
            unit_price: unitPrice,
            subtotal: unitPrice * quantity,
            remark: nullableText(item.remark),
            sort_order: itemIndex + 1,
            updated_at: new Date().toISOString(),
          };
        });
      });

      const { data: insertedItems, error: itemError } = await supabase
        .from('order_items')
        .insert(itemInserts)
        .select();
      if (itemError) throw new Error(itemError.message);

      const items = insertedItems as OrderItemRow[];
      const itemByNo = new Map(items.map((item) => [item.item_no || '', item]));

      const spaceInserts = values.modules.map((module, moduleIndex) => ({
        order_id: order.id,
        space_no: `${values.order_no.trim()}-S${String(moduleIndex + 1).padStart(2, '0')}`,
        space_name: module.module_name.trim(),
        space_type: 'custom',
        sort_order: moduleIndex + 1,
        status: 'draft',
        remark: nullableText(module.remark),
        updated_at: new Date().toISOString(),
      }));
      const { data: insertedSpaces, error: spaceError } = await supabase
        .from('order_spaces')
        .insert(spaceInserts)
        .select();
      if (spaceError) throw new Error(spaceError.message);

      const spaces = (insertedSpaces || []) as { id: string; space_no: string }[];
      const spaceByNo = new Map(spaces.map((space) => [space.space_no, space]));
      const productInserts = values.modules.flatMap((module, moduleIndex) => {
        const spaceNo = `${values.order_no.trim()}-S${String(moduleIndex + 1).padStart(2, '0')}`;
        const insertedSpace = spaceByNo.get(spaceNo);
        if (!insertedSpace) return [];

        return module.items.map((item, itemIndex) => {
          const unitPrice = yuanToCents(item.unit_price);
          const quantity = Number(item.quantity || 1);
          const productNo = `${spaceNo}-P${String(itemIndex + 1).padStart(2, '0')}`;
          return {
            order_id: order.id,
            space_id: insertedSpace.id,
            product_no: productNo,
            product_name: item.product_name.trim(),
            product_type: item.product_type || (item.hardware ? 'hardware' : 'custom'),
            width: item.width_mm ?? null,
            height: item.length_mm ?? null,
            depth: item.thickness_mm ?? null,
            quantity,
            material: nullableText(item.material) || nullableText(item.specification),
            color: nullableText(item.color),
            status: 'draft',
            quoted_amount: unitPrice * quantity,
            cost_amount: 0,
            profit_amount: 0,
            sort_order: itemIndex + 1,
            remark: nullableText(item.remark),
            updated_at: new Date().toISOString(),
          };
        });
      });

      let productByNo = new Map<string, { id: string; product_no: string; space_id: string }>();
      if (productInserts.length > 0) {
        const { data: insertedProducts, error: productError } = await supabase
          .from('order_products')
          .insert(productInserts)
          .select('id, product_no, space_id');
        if (productError) throw new Error(productError.message);
        productByNo = new Map(
          ((insertedProducts || []) as { id: string; product_no: string; space_id: string }[])
            .map((product) => [product.product_no, product])
        );
      }

      const taskInserts = values.modules.flatMap((module, moduleIndex) => {
        const spaceNo = `${values.order_no.trim()}-S${String(moduleIndex + 1).padStart(2, '0')}`;
        const insertedSpace = spaceByNo.get(spaceNo);
        if (!insertedSpace) return [];

        return module.items.flatMap((item, itemIndex) => {
          const productNo = `${spaceNo}-P${String(itemIndex + 1).padStart(2, '0')}`;
          const insertedProduct = productByNo.get(productNo);
          if (!insertedProduct) return [];

          return item.tasks.map((task, taskIndex) => {
            const taskNotes = [
              nullableText(task.construction_surface) ? `施工面：${task.construction_surface.trim()}` : null,
              nullableText(task.hardware) ? `五金：${task.hardware.trim()}` : null,
              task.hardware_quantity !== undefined && task.hardware_quantity !== null ? `五金数量：${task.hardware_quantity}` : null,
              nullableText(task.remark),
            ].filter(Boolean).join('\n');

            return {
              order_id: order.id,
              space_id: insertedSpace.id,
              product_id: insertedProduct.id,
              tenant_id: values.to_tenant_id,
              task_no: `${productNo}-T${String(taskIndex + 1).padStart(2, '0')}`,
              task_type: task.task_type,
              task_name: task.task_name.trim(),
              task_code: nullableText(task.task_code),
              product_name: item.product_name.trim(),
              quantity: Number(task.quantity || 1),
              unit: task.unit || item.unit || '件',
              length: task.length_mm ?? item.length_mm ?? null,
              width: task.width_mm ?? item.width_mm ?? null,
              thickness: task.thickness_mm ?? item.thickness_mm ?? null,
              area: task.area ?? null,
              material: nullableText(task.material) || nullableText(item.material) || nullableText(item.specification),
              color: nullableText(task.color) || nullableText(item.color),
              process_name: nullableText(task.process_name),
              status: 'pending_generate',
              remark: nullableText(taskNotes),
              updated_at: new Date().toISOString(),
            };
          });
        });
      });

      if (taskInserts.length > 0) {
        const { error: taskError } = await supabase
          .from('production_tasks')
          .insert(taskInserts);
        if (taskError) throw new Error(taskError.message);
      }

      const attachmentInserts = values.modules.flatMap((module, moduleIndex) => {
        const moduleNo = `${values.order_no.trim()}-M${String(moduleIndex + 1).padStart(2, '0')}`;
        const insertedModule = moduleByNo.get(moduleNo);
        if (!insertedModule) return [];

        return module.items.flatMap((item, itemIndex) => {
          const itemNo = `${moduleNo}-I${String(itemIndex + 1).padStart(2, '0')}`;
          const insertedItem = itemByNo.get(itemNo);
          if (!insertedItem) return [];

          return item.attachments.map((attachment) => ({
            order_id: order.id,
            module_id: insertedModule.id,
            order_item_id: insertedItem.id,
            tenant_id: user.tenant_id,
            file_name: attachment.file_name,
            file_path: attachment.file_path,
            file_url: attachment.file_url,
            file_type: attachment.file_type || null,
            file_size: attachment.file_size || null,
            uploaded_by: user.id,
          }));
        });
      });

      if (attachmentInserts.length > 0) {
        const { error: attachmentError } = await supabase
          .from('order_item_attachments')
          .insert(attachmentInserts);
        if (attachmentError) throw new Error(attachmentError.message);
      }

      await supabase.from('order_exchanges').insert({
        order_id: order.id,
        from_tenant_id: user.tenant_id,
        to_tenant_id: values.to_tenant_id,
        from_user_id: user.id,
        status: 'sent',
        message: nullableText(values.remark),
        updated_at: new Date().toISOString(),
      });

      const { data: fullOrder, error: fullError } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .eq('id', order.id)
        .single();
      if (fullError) throw new Error(fullError.message);

      const hydrated = await hydrateOrders(supabase, [fullOrder as OrderRow]);
      return NextResponse.json({ success: true, data: hydrated[0] || fullOrder });
    } catch (nestedError) {
      await supabase.from('orders').delete().eq('id', order.id);
      throw nestedError;
    }
  } catch (error) {
    console.error('create order failed:', error);
    return jsonError(error instanceof Error ? error.message : '创建订单失败', 500);
  }
}
