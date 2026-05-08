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
          .lte('created_at', monthEnd),
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
          q.orderQuery,
          q.dealerQuery,
          q.customerQuery,
        ]);
        const orders = orderRes.data || [];
        const dealers = dealerRes.data || [];
        const customers = customerRes.data || [];
        return {
          month: q.monthLabel,
          orders: orders.length,
          revenue: orders.reduce((sum: number, o: Record<string, unknown>) => sum + (Number(o.total_amount) || 0), 0),
          newDealers: dealers.length,
          newCustomers: customers.length,
        };
      })
    );

    return NextResponse.json(
      { success: true, data: results },
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
