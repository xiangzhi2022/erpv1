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

    const queries = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');
      const monthLabel = format(monthDate, 'M月');

      queries.push({
        monthLabel,
        monthStart,
        monthEnd,
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
      });
    }

    // 并行请求所有月份数据
    const results = await Promise.all(
      queries.map(async (q) => {
        const [orderRes, dealerRes] = await Promise.all([
          q.orderQuery,
          q.dealerQuery,
        ]);
        const orders = orderRes.data || [];
        const dealers = dealerRes.data || [];
        return {
          month: q.monthLabel,
          orders: orders.length,
          revenue: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
          newDealers: dealers.length,
        };
      })
    );

    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    console.error('Dashboard chart data error:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
