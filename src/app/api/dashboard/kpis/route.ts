import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

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

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();
    const now = new Date();
    const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const thisMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

    // 并行获取所有数据
    const [
      ordersResult,
      thisMonthOrdersResult,
      lastMonthOrdersResult,
      tenantsResult,
      thisMonthCustomersResult,
      lastMonthCustomersResult,
      tasksResult,
    ] = await Promise.all([
      // 所有订单
      supabase.from('orders').select('status, total_amount, created_at'),
      // 本月订单
      supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', thisMonthStart)
        .lte('created_at', thisMonthEnd),
      // 上月订单
      supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', lastMonthStart)
        .lte('created_at', lastMonthEnd),
      // 所有租户（经销商）
      supabase.from('tenants').select('id, tenant_type, created_at'),
      // 本月新增客户
      supabase
        .from('customers')
        .select('id')
        .gte('created_at', thisMonthStart)
        .lte('created_at', thisMonthEnd),
      // 上月新增客户
      supabase
        .from('customers')
        .select('id')
        .gte('created_at', lastMonthStart)
        .lte('created_at', lastMonthEnd),
      // 待处理任务
      supabase.from('tasks').select('id, status').in('status', ['pending', 'in_progress']),
    ]);

    const allOrders = ordersResult.data || [];
    const thisMonthOrders = thisMonthOrdersResult.data || [];
    const lastMonthOrders = lastMonthOrdersResult.data || [];
    const allTenants = tenantsResult.data || [];
    const thisMonthCustomers = thisMonthCustomersResult.data || [];
    const lastMonthCustomers = lastMonthCustomersResult.data || [];

    // 计算核心指标
    const dealerCount = allTenants.filter((t) => t.tenant_type === 'dealer').length;
    const thisMonthNewCustomers = thisMonthCustomers.length;
    const lastMonthNewCustomers = lastMonthCustomers.length;
    const pendingOrders = allOrders.filter(
      (o) => o.status === 'pending' || o.status === 'returned'
    ).length;
    const thisMonthRevenue = thisMonthOrders.reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0
    );
    const lastMonthRevenue = lastMonthOrders.reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0
    );
    const pendingTasks = tasksResult.data?.length || 0;
    const producingOrders = allOrders.filter((o) => o.status === 'producing').length;
    const completedOrders = allOrders.filter(
      (o) => o.status === 'completed' || o.status === 'shipped'
    ).length;

    // 环比增长计算
    const customerGrowth =
      lastMonthNewCustomers > 0
        ? Number(
            (
              ((thisMonthNewCustomers - lastMonthNewCustomers) / lastMonthNewCustomers) *
              100
            ).toFixed(1)
          )
        : thisMonthNewCustomers > 0
          ? 100
          : 0;

    const revenueGrowth =
      lastMonthRevenue > 0
        ? Number(
            (
              ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) *
              100
            ).toFixed(1)
          )
        : thisMonthRevenue > 0
          ? 100
          : 0;

    const kpis = {
      dealerCount,
      dealerGrowth: 0, // 需要历史数据才能计算
      thisMonthNewCustomers,
      customerGrowth,
      pendingOrders,
      producingOrders,
      completedOrders,
      thisMonthRevenue,
      revenueGrowth,
      pendingTasks,
    };

    return NextResponse.json({ success: true, data: kpis });
  } catch (err) {
    console.error('Dashboard KPIs error:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
