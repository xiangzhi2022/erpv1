import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

type Row = Record<string, unknown>;
type DashboardUser = {
  id?: string;
  role?: string;
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
      console.warn(`Dashboard chart fallback for ${label}:`, error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`Dashboard chart fallback for ${label}:`, error);
    return [];
  }
}

const statusLabels: Record<string, string> = {
  pending: '待接收',
  returned: '已退回',
  confirmed: '已接收',
  producing: '生产中',
  pool: '订单池',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

const statusColorMap: Record<string, string> = {
  pending: 'hsl(var(--chart-1))',
  returned: 'hsl(0 72% 51%)',
  confirmed: 'hsl(var(--chart-2))',
  producing: 'hsl(var(--chart-3))',
  pool: 'hsl(var(--chart-4))',
  shipped: 'hsl(var(--chart-5))',
  completed: 'hsl(142 71% 45%)',
  cancelled: 'hsl(215 14% 34%)',
};

export async function GET() {
  try {
    const user = (await getCurrentUser()) as DashboardUser | null;
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const now = new Date();
    const isAdmin = user.role === 'super_admin' || user.role === 'saas_admin';
    const orderFilter = !isAdmin && user.id ? { created_by: user.id } : {};

    // 获取过去6个月的数据
    const queries = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
      const monthLabel = format(monthDate, 'M月');

      queries.push({
        monthLabel,
        orderQuery: supabase
          .from('orders')
          .select('total_amount')
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd)
          .match(orderFilter),
        dealerQuery: supabase
          .from('tenants')
          .select('id')
          .eq('tenant_type', 'dealer')
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd),
        customerQuery: supabase
          .from('customers')
          .select('id')
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd),
      });
    }

    // 并行请求所有月份数据
    const results = await Promise.all(
      queries.map(async (q) => {
        const [orderRes, dealerRes, customerRes] = await Promise.all([
          safeRows(`orders_${q.monthLabel}`, q.orderQuery),
          safeRows(`dealers_${q.monthLabel}`, q.dealerQuery),
          safeRows(`customers_${q.monthLabel}`, q.customerQuery),
        ]);
        return {
          month: q.monthLabel,
          orders: orderRes.length,
          revenue: orderRes.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
          newDealers: dealerRes.length,
          newCustomers: customerRes.length,
        };
      })
    );

    const statusRows = await safeRows(
      'order_status_distribution',
      supabase.from('orders').select('status').match(orderFilter)
    );
    const statusCount = statusRows.reduce<Record<string, number>>((acc, order) => {
      const status = String(order.status || 'pending');
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const statusDistribution = Object.entries(statusCount)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([status, count]) => ({
        status,
        name: status,
        label: statusLabels[status] || status,
        value: count,
        fill: statusColorMap[status] || 'hsl(var(--muted))',
      }));

    return NextResponse.json(
      { success: true, data: results, statusDistribution },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      }
    );
  } catch (err) {
    console.error('Dashboard chart data error:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
