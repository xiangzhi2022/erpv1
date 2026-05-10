import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { workOrderQuerySchema, WorkOrderStatus, type ProgressStats, type WorkOrder } from '@/app/progress/schemas';

/** Check if a string is a valid UUID v4 format */
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Safely resolve operator name from user, with fallback chain */
function resolveOperatorName(user: { nickname?: string; phone?: string; email?: string; name?: string }): string {
  return user.nickname || user.phone || user.email || user.name || '未知操作人';
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = workOrderQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: '参数错误', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, workshop_id, keyword, priority, page, page_size } = parsed.data;
    const supabase = getSupabaseClient();

    // Build query - fetch work orders with optional related data
    let query = supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .range((page - 1) * page_size, page * page_size - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (workshop_id) {
      query = query.eq('workshop_id', workshop_id);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询工单失败: ${error.message}`);
    }

    // Keyword filter (client-side since we can't do full-text search easily)
    let workOrders = (data || []) as WorkOrder[];
    if (keyword?.trim()) {
      const kw = keyword.trim().toLowerCase();
      workOrders = workOrders.filter(
        (wo) =>
          wo.product_name?.toLowerCase().includes(kw) ||
          wo.order?.order_no?.toLowerCase().includes(kw) ||
          wo.order?.customer_name?.toLowerCase().includes(kw)
      );
    }

    // Get total count for stats
    const { count: totalCount, error: countError } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`统计失败: ${countError.message}`);
    }

    // Get status distribution for stats - aligned with canonical status names
    const { data: allOrders, error: statsError } = await supabase
      .from('work_orders')
      .select('status, expected_end_date, completed_quantity, target_quantity');

    if (statsError) {
      throw new Error(`统计查询失败: ${statsError.message}`);
    }

    const now = new Date();
    const stats: ProgressStats = {
      total: allOrders?.length || 0,
      pending: allOrders?.filter((o: Record<string, unknown>) => o.status === WorkOrderStatus.PENDING).length || 0,
      producing: allOrders?.filter((o: Record<string, unknown>) => o.status === WorkOrderStatus.PRODUCING).length || 0,
      inspecting: allOrders?.filter((o: Record<string, unknown>) => o.status === WorkOrderStatus.INSPECTING).length || 0,
      stored: allOrders?.filter((o: Record<string, unknown>) => o.status === WorkOrderStatus.STORED).length || 0,
      aborted: allOrders?.filter((o: Record<string, unknown>) => o.status === WorkOrderStatus.ABORTED).length || 0,
      overdue:
        allOrders?.filter((o: Record<string, unknown>) => {
          if (!o.expected_end_date || o.status === WorkOrderStatus.STORED || o.status === WorkOrderStatus.ABORTED)
            return false;
          return new Date(String(o.expected_end_date)) < now;
        }).length || 0,
    };

    return NextResponse.json({
      success: true,
      data: workOrders,
      stats,
      pagination: {
        page,
        page_size,
        total: totalCount || 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    console.error('获取工单失败:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Create a new work order
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { order_id, workshop_id, product_name, target_quantity, priority, expected_end_date, remark } = body;

    if (!product_name || target_quantity === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: product_name, target_quantity' },
        { status: 400 }
      );
    }

    if (target_quantity <= 0) {
      return NextResponse.json(
        { success: false, error: '目标数量必须大于0' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Build insert data — only include columns that exist in the DB schema
    const insertData: Record<string, unknown> = {
      workshop_id: workshop_id || null,
      product_name,
      target_quantity,
      completed_quantity: 0,
      status: WorkOrderStatus.PENDING,
      priority: priority || 'normal',
      expected_end_date: expected_end_date || null,
      remark: remark || null,
    };

    // Only set order_id if it is a valid UUID (the column is UUID type and nullable)
    if (order_id && isValidUUID(String(order_id))) {
      insertData.order_id = order_id;
    }

    // Create work order with initial status 'pending'
    const { data, error } = await supabase
      .from('work_orders')
      .insert(insertData)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`创建工单失败: ${error.message}`);
    }

    if (!data) {
      throw new Error('创建工单失败: 未返回数据');
    }

    // Write initial progress log on work order creation
    // operator_id is UUID type — only set if user.id is a valid UUID
    const logInsertData: Record<string, unknown> = {
      work_order_id: data.id,
      operator_name: resolveOperatorName(user),
      action: 'start',
      completed_delta: 0,
      remark: '工单创建',
    };
    if (isValidUUID(user.id)) {
      logInsertData.operator_id = user.id;
    }

    const { error: logError } = await supabase.from('progress_logs').insert(logInsertData);

    if (logError) {
      console.error('创建进度日志失败:', logError.message);
      // Non-fatal: work order is created, log failure should not block
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    console.error('创建工单失败:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
