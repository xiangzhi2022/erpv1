import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';
import { ORDER_STATUSES, STATUS_TRANSITIONS } from '@/app/orders/schemas';

const getServiceClient = () => getSupabaseClient();

interface CurrentUser {
  id: string;
  role: string;
  tenant_id?: string;
}

async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const userStr = cookieStore.get('erp_user')?.value;
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// Valid status values for filtering
const VALID_STATUSES = new Set<string>(ORDER_STATUSES);

function canAccessAllTenants(user: CurrentUser): boolean {
  return user.role === 'super_admin' || user.role === 'saas_admin';
}

// GET /api/orders - Fetch orders with pagination, search, filtering, and items
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getServiceClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build query with order items
    let query = supabase
      .from('orders')
      .select('*, items:order_items(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Non-platform users are scoped by tenant_id instead of per-user ownership.
    if (!canAccessAllTenants(user)) {
      if (!user.tenant_id) {
        return Response.json({ success: false, error: '当前用户未关联租户' }, { status: 403 });
      }
      query = query.eq('tenant_id', user.tenant_id);
    }

    // Status filter - validate before applying
    if (status && status !== 'all') {
      const requestedStatuses = status.split(',').map((s) => s.trim()).filter(Boolean);
      const statuses = requestedStatuses.filter((s) => VALID_STATUSES.has(s));
      if (statuses.length !== requestedStatuses.length) {
        return Response.json({ success: false, error: '订单状态筛选值无效' }, { status: 400 });
      }
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in('status', statuses);
      }
    }

    // Search filter (order number or customer name)
    if (search && search.trim()) {
      query = query.or(`order_no.ilike.%${search.trim()}%,customer_name.ilike.%${search.trim()}%`);
    }

    // Date range filter
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59');
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Get orders error:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    // Get status statistics (using same permission scope)
    let statsQuery = supabase.from('orders').select('status');
    if (!canAccessAllTenants(user)) {
      statsQuery = statsQuery.eq('tenant_id', user.tenant_id);
    }
    const { data: allOrders, error: statsError } = await statsQuery;

    if (statsError) {
      console.error('Get order stats error:', statsError);
      return Response.json({ success: false, error: statsError.message }, { status: 500 });
    }

    const stats = {
      total: allOrders?.length || 0,
      pending: allOrders?.filter((o: { status: string }) => o.status === 'pending').length || 0,
      returned: allOrders?.filter((o: { status: string }) => o.status === 'returned').length || 0,
      confirmed: allOrders?.filter((o: { status: string }) => o.status === 'confirmed').length || 0,
      pool: allOrders?.filter((o: { status: string }) => o.status === 'pool').length || 0,
      producing: allOrders?.filter((o: { status: string }) => o.status === 'producing').length || 0,
      shipped: allOrders?.filter((o: { status: string }) => o.status === 'shipped').length || 0,
      completed: allOrders?.filter((o: { status: string }) => o.status === 'completed').length || 0,
      cancelled: allOrders?.filter((o: { status: string }) => o.status === 'cancelled').length || 0,
    };

    return Response.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      stats,
    });
  } catch (err) {
    console.error('Get orders error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/orders - Create order with items
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { order_no, customer_name, customer_phone, delivery_date, remark, items, target_factory_id } = body;

    // Validate required fields
    if (!order_no || !order_no.trim()) {
      return Response.json({ success: false, error: '订单号不能为空' }, { status: 400 });
    }
    if (!customer_name || !customer_name.trim()) {
      return Response.json({ success: false, error: '客户名称不能为空' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ success: false, error: '订单项不能为空' }, { status: 400 });
    }

    // Validate each order item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product_name || !item.product_name.trim()) {
        return Response.json({ success: false, error: `第${i + 1}项: 产品名称不能为空` }, { status: 400 });
      }
      if (!item.quantity || item.quantity < 1) {
        return Response.json({ success: false, error: `第${i + 1}项: 数量必须大于0` }, { status: 400 });
      }
    }

    const supabase = getServiceClient();

    // Check for duplicate order_no
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('order_no', order_no.trim())
      .maybeSingle();

    if (existing) {
      return Response.json({ success: false, error: '订单号已存在，请重新生成' }, { status: 409 });
    }

    // Calculate total amount from items (all amounts in cents)
    let totalAmount = 0;
    const orderItems = items.map((item: { product_name: string; specification?: string; quantity: number; unit: string; unit_price: number; remark?: string }) => {
      const subtotal = (item.quantity || 1) * (item.unit_price || 0);
      totalAmount += subtotal;
      return {
        product_name: item.product_name,
        specifications: item.specification || null,
        quantity: item.quantity || 1,
        unit: item.unit || '件',
        unit_price: item.unit_price || 0,
        subtotal,
        remark: item.remark || null,
      };
    });

    // Create order - only use columns that exist in DB schema
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_no: order_no.trim(),
        customer_name: customer_name.trim(),
        customer_phone: customer_phone?.trim() || null,
        status: 'pending',
        total_amount: totalAmount,
        delivery_date: delivery_date || null,
        remark: remark || null,
        tenant_id: user.tenant_id || null,
        target_factory_id: target_factory_id || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Create order error:', orderError);
      return Response.json({ success: false, error: orderError.message }, { status: 500 });
    }

    // Create order items
    const itemsWithOrderId = orderItems.map((item: Record<string, unknown>) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      console.error('Create order items error:', itemsError);
      // Rollback: delete the created order
      await supabase.from('orders').delete().eq('id', order.id);
      return Response.json({ success: false, error: '创建订单明细失败' }, { status: 500 });
    }

    // Return full order with items
    const { data: fullOrder } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', order.id)
      .single();

    return Response.json({ success: true, data: fullOrder || order });
  } catch (err) {
    console.error('Create order error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// PUT /api/orders - Backward-compatible status update endpoint.
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    if (!canAccessAllTenants(user) && !user.tenant_id) {
      return Response.json({ success: false, error: '当前用户未关联租户' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, notes } = body as { id?: string; status?: string; notes?: string };

    if (!id) {
      return Response.json({ success: false, error: '订单 ID 不能为空' }, { status: 400 });
    }
    if (!status || !VALID_STATUSES.has(status)) {
      return Response.json({ success: false, error: '无效的状态值' }, { status: 400 });
    }

    const supabase = getServiceClient();
    let fetchQuery = supabase
      .from('orders')
      .select('id, status, tenant_id')
      .eq('id', id);

    if (!canAccessAllTenants(user)) {
      if (!user.tenant_id) {
        return Response.json({ success: false, error: '当前用户未关联租户' }, { status: 403 });
      }
      fetchQuery = fetchQuery.eq('tenant_id', user.tenant_id);
    }

    const { data: existingOrder, error: fetchError } = await fetchQuery.single();

    if (fetchError || !existingOrder) {
      return Response.json({ success: false, error: '订单不存在或无权操作' }, { status: 404 });
    }

    const currentStatus = existingOrder.status as string;
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
    if (status !== currentStatus && (!allowedTransitions || !allowedTransitions.has(status))) {
      return Response.json(
        { success: false, error: `不允许从「${currentStatus}」变更为「${status}」` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (typeof notes === 'string' && notes.trim()) {
      updateData.remark = notes.trim();
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select('*, items:order_items(*)')
      .single();

    if (error) {
      console.error('Update order status error:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Update order status error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
