import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

type Row = Record<string, unknown>;
async function safeRows(
  label: string,
  query: PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<Row[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn(`Dashboard KPI fallback for ${label}:`, error);
      return [];
    }
    return Array.isArray(data) ? data as Row[] : [];
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

export async function GET(request: Request) {
  try {
    void request;
    const context = await getEnterpriseContext();
    requirePermission(context, 'dashboard.read');
    const supabase = await createClient();
    const now = new Date();
    const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const thisMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

    const [
      allOrders,
      thisMonthOrders,
      lastMonthOrders,
      allDealers,
      lastMonthDealers,
      thisMonthCustomers,
      lastMonthCustomers,
      pendingTaskRows,
    ] = await Promise.all([
      safeRows('orders', supabase.from('orders').select('status, total_amount, created_at').eq('enterprise_id', context.enterpriseId)),
      safeRows(
        'this_month_orders',
        supabase
          .from('orders')
          .select('total_amount')
          .eq('enterprise_id', context.enterpriseId)
          .gte('created_at', thisMonthStart)
          .lte('created_at', thisMonthEnd)
      ),
      safeRows(
        'last_month_orders',
        supabase
          .from('orders')
          .select('total_amount')
          .eq('enterprise_id', context.enterpriseId)
          .gte('created_at', lastMonthStart)
          .lte('created_at', lastMonthEnd)
      ),
      safeRows('dealers', supabase.from('dealers').select('id, created_at').eq('enterprise_id', context.enterpriseId)),
      safeRows(
        'last_month_dealers',
        supabase
          .from('dealers')
          .select('id, created_at')
          .eq('enterprise_id', context.enterpriseId)
          .lte('created_at', lastMonthEnd)
      ),
      safeRows(
        'this_month_customers',
        supabase.from('customers').select('id').eq('enterprise_id', context.enterpriseId).gte('created_at', thisMonthStart).lte('created_at', thisMonthEnd)
      ),
      safeRows(
        'last_month_customers',
        supabase.from('customers').select('id').eq('enterprise_id', context.enterpriseId).gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd)
      ),
      safeRows('pending_tasks', supabase.from('tasks').select('id, status').eq('enterprise_id', context.enterpriseId).in('status', ['pending', 'in_progress'])),
    ]);

    // 核心指标计算
    const dealerCount = allDealers.length;
    const lastMonthDealerCount = lastMonthDealers.length;
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
