import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

type Row = Record<string, unknown>;
type DashboardUser = {
  id?: string;
  role?: string;
  tenant_id?: string;
};

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

async function safeRows<T extends Row>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn(`Dashboard KPI fallback for ${label}:`, error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`Dashboard KPI fallback for ${label}:`, error);
    return [];
  }
}

function calcGrowth(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function GET() {
  try {
    const user = (await getCurrentUser()) as DashboardUser | null;
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
    const orderFilter = !isAdmin && user.id ? { created_by: user.id } : {};
    const tenantFilter = !isAdmin && user.tenant_id ? { id: user.tenant_id } : {};

    const [
      allOrders,
      thisMonthOrders,
      lastMonthOrders,
      allTenants,
      lastMonthTenants,
      thisMonthCustomers,
      lastMonthCustomers,
      pendingTaskRows,
    ] = await Promise.all([
      safeRows('orders', supabase.from('orders').select('status, total_amount, created_at').match(orderFilter)),
      safeRows(
        'this_month_orders',
        supabase
          .from('orders')
          .select('total_amount')
          .gte('created_at', thisMonthStart)
          .lte('created_at', thisMonthEnd)
          .match(orderFilter)
      ),
      safeRows(
        'last_month_orders',
        supabase
          .from('orders')
          .select('total_amount')
          .gte('created_at', lastMonthStart)
          .lte('created_at', lastMonthEnd)
          .match(orderFilter)
      ),
      safeRows('tenants', supabase.from('tenants').select('id, tenant_type, created_at').match(tenantFilter)),
      safeRows(
        'last_month_tenants',
        supabase
          .from('tenants')
          .select('id, tenant_type, created_at')
          .lte('created_at', lastMonthEnd)
          .match(tenantFilter)
      ),
      safeRows(
        'this_month_customers',
        supabase.from('customers').select('id').gte('created_at', thisMonthStart).lte('created_at', thisMonthEnd)
      ),
      safeRows(
        'last_month_customers',
        supabase.from('customers').select('id').gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd)
      ),
      safeRows('pending_tasks', supabase.from('tasks').select('id, status').in('status', ['pending', 'in_progress'])),
    ]);

    // 核心指标计算
    const dealerCount = allTenants.filter((t) => t.tenant_type === 'dealer').length;
    const lastMonthDealerCount = lastMonthTenants.filter((t) => t.tenant_type === 'dealer').length;
    const thisMonthNewCustomers = thisMonthCustomers.length;
    const lastMonthNewCustomers = lastMonthCustomers.length;

    const pendingOrders = allOrders.filter(
      (o) => o.status === 'pending' || o.status === 'returned'
    ).length;
    const producingOrders = allOrders.filter((o) => o.status === 'producing').length;
    const completedOrders = allOrders.filter(
      (o) => o.status === 'completed' || o.status === 'shipped'
    ).length;
    const poolOrders = allOrders.filter(
      (o) => o.status === 'confirmed' || o.status === 'pool'
    ).length;

    const thisMonthRevenue = thisMonthOrders.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0
    );
    const lastMonthRevenue = lastMonthOrders.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0
    );
    const pendingTasks = pendingTaskRows.length;

    const kpis = {
      dealerCount,
      dealerGrowth: calcGrowth(dealerCount, lastMonthDealerCount),
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
