import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
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

    const supabase = getSupabaseClient();
    const now = new Date();
    const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const thisMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

    // 构建订单查询 - 根据角色过滤
    const isAdmin = user.role === 'super_admin' || user.role === 'saas_admin';
    const orderFilter = isAdmin ? {} : { created_by: user.id };
    const tenantFilter = isAdmin ? {} : { id: user.tenant_id };

    // 并行获取所有数据
    const [
      ordersResult,
      thisMonthOrdersResult,
      lastMonthOrdersResult,
      tenantsResult,
      lastMonthTenantsResult,
      thisMonthCustomersResult,
      lastMonthCustomersResult,
      tasksResult,
    ] = await Promise.all([
      // 所有订单（含状态和金额）
      supabase
        .from('orders')
        .select('status, total_amount, created_at')
        .match(orderFilter),
      // 本月订单
      supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', thisMonthStart)
        .lte('created_at', thisMonthEnd)
        .match(orderFilter),
      // 上月订单
      supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', lastMonthStart)
        .lte('created_at', lastMonthEnd)
        .match(orderFilter),
      // 所有租户
      supabase
        .from('tenants')
        .select('id, tenant_type, created_at')
        .match(tenantFilter),
      // 上月租户（用于计算经销商环比）
      supabase
        .from('tenants')
        .select('id, tenant_type')
        .lte('created_at', lastMonthEnd)
        .match(tenantFilter),
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
    const lastMonthTenants = lastMonthTenantsResult.data || [];
    const thisMonthCustomers = thisMonthCustomersResult.data || [];
    const lastMonthCustomers = lastMonthCustomersResult.data || [];

    // 核心指标计算
    const dealerCount = allTenants.filter((t: Record<string, unknown>) => t.tenant_type === 'dealer').length;
    const lastMonthDealerCount = lastMonthTenants.filter((t: Record<string, unknown>) => t.tenant_type === 'dealer').length;
    const thisMonthNewCustomers = thisMonthCustomers.length;
    const lastMonthNewCustomers = lastMonthCustomers.length;

    const pendingOrders = allOrders.filter(
      (o: Record<string, unknown>) => o.status === 'pending' || o.status === 'returned'
    ).length;
    const producingOrders = allOrders.filter((o: Record<string, unknown>) => o.status === 'producing').length;
    const completedOrders = allOrders.filter(
      (o: Record<string, unknown>) => o.status === 'completed' || o.status === 'shipped'
    ).length;
    const poolOrders = allOrders.filter(
      (o: Record<string, unknown>) => o.status === 'confirmed' || o.status === 'pool'
    ).length;

    const thisMonthRevenue = thisMonthOrders.reduce(
      (sum: number, o: Record<string, unknown>) => sum + (Number(o.total_amount) || 0),
      0
    );
    const lastMonthRevenue = lastMonthOrders.reduce(
      (sum: number, o: Record<string, unknown>) => sum + (Number(o.total_amount) || 0),
      0
    );
    const pendingTasks = tasksResult.data?.length || 0;

    // 环比增长计算（安全除法）
    const calcGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const kpis = {
      dealerCount,
      dealerGrowth: calcGrowth(dealerCount - (dealerCount - (allTenants.filter(
        (t: Record<string, unknown>) => t.tenant_type === 'dealer' && new Date(String(t.created_at)) >= new Date(thisMonthStart)
      ).length)), lastMonthDealerCount),
      thisMonthNewCustomers,
      customerGrowth: calcGrowth(thisMonthNewCustomers, lastMonthNewCustomers),
      pendingOrders,
      producingOrders,
      completedOrders,
      poolOrders,
      thisMonthRevenue,
      revenueGrowth: calcGrowth(thisMonthRevenue, lastMonthRevenue),
      pendingTasks,
      totalOrders: allOrders.length,
      thisMonthOrders: thisMonthOrders.length,
      lastMonthOrders: lastMonthOrders.length,
    };

    return NextResponse.json(
      { success: true, data: kpis },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (err) {
    console.error('Dashboard KPIs error:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
