import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

const getServiceClient = () => getSupabaseClient();

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userStr = cookieStore.get('erp_user')?.value;
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
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

    // Permission filter: super_admin/saas_admin sees all, others see own
    if (user.role !== 'super_admin' && user.role !== 'saas_admin') {
      query = query.eq('created_by', user.id);
    }

    // Status filter
    if (status && status !== 'all') {
      const statuses = status.split(',');
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else {
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

    // Get status statistics
    let statsQuery = supabase.from('orders').select('status');
    if (user.role !== 'super_admin' && user.role !== 'saas_admin') {
      statsQuery = statsQuery.eq('created_by', user.id);
    }
    const { data: allOrders } = await statsQuery;

    const stats = {
      total: allOrders?.length || 0,
      pending: allOrders?.filter((o: { status: string }) => o.status === 'pending').length || 0,
      returned: allOrders?.filter((o: { status: string }) => o.status === 'returned').length || 0,
      confirmed: allOrders?.filter((o: { status: string }) => o.status === 'confirmed').length || 0,
      pool: allOrders?.filter((o: { status: string }) => o.status === 'pool').length || 0,
      producing: allOrders?.filter((o: { status: string }) => o.status === 'producing' || o.status === 'in_production').length || 0,
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
    const { order_no, customer_name, delivery_date, remark, items } = body;

    if (!order_no) {
      return Response.json({ success: false, error: '订单号不能为空' }, { status: 400 });
    }
    if (!customer_name) {
      return Response.json({ success: false, error: '客户名称不能为空' }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return Response.json({ success: false, error: '订单项不能为空' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Calculate total amount from items
    let totalAmount = 0;
    const orderItems = items.map((item: { product_name: string; specification?: string; quantity: number; unit: string; unit_price: number }) => {
      const subtotal = (item.quantity || 1) * (item.unit_price || 0);
      totalAmount += subtotal;
      return {
        product_name: item.product_name,
        specifications: item.specification || null,
        quantity: item.quantity || 1,
        unit: item.unit || '件',
        unit_price: item.unit_price || 0,
        subtotal,
      };
    });

    // Create order (using actual DB schema columns)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_no,
        customer_name,
        status: 'pending',
        total_amount: totalAmount,
        delivery_date: delivery_date || null,
        remark: remark || null,
        created_by: user.id,
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

// PUT /api/orders - Update order status
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id || !status) {
      return Response.json({ success: false, error: '缺少订单ID或状态' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (notes !== undefined) {
      updateData.remark = notes;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update order error:', error);
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Update order error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
