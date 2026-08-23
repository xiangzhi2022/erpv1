import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';

type Row = Record<string, unknown>;

async function safeRows(
  label: string,
  query: PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<Row[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn(`Dashboard activity fallback for ${label}:`, error);
      return [];
    }
    return Array.isArray(data) ? data as Row[] : [];
  } catch (error) {
    console.warn(`Dashboard activity fallback for ${label}:`, error);
    return [];
  }
}

interface ActivityItem {
  id: string;
  type: 'order' | 'dealer' | 'customer' | 'task';
  title: string;
  description: string;
  timestamp: string;
  operatorName?: string;
}

export async function GET(request: Request) {
  try {
    void request;
    const context = await getEnterpriseContext();
    requirePermission(context, 'dashboard.read');
    const supabase = await createClient();

    // 并行获取各类最近活动
    const [recentOrders, recentDealers, recentCustomers, recentTasks] =
      await Promise.all([
        safeRows(
          'orders',
          supabase
            .from('orders')
            .select('id, order_no, customer_name, status, created_at')
            .eq('enterprise_id', context.enterpriseId)
            .order('created_at', { ascending: false })
            .limit(5)
        ),
        safeRows(
          'dealers',
          supabase
            .from('dealers')
            .select('id, name, created_at')
            .eq('enterprise_id', context.enterpriseId)
            .order('created_at', { ascending: false })
            .limit(3)
        ),
        safeRows(
          'customers',
          supabase
            .from('customers')
            .select('id, name, created_at')
            .eq('enterprise_id', context.enterpriseId)
            .order('created_at', { ascending: false })
            .limit(3)
        ),
        safeRows(
          'tasks',
          supabase
            .from('tasks')
            .select('id, title, status, created_at')
            .eq('enterprise_id', context.enterpriseId)
            .order('created_at', { ascending: false })
            .limit(3)
        ),
      ]);

    const activities: ActivityItem[] = [];

    // 订单活动
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

    for (const order of recentOrders) {
      const status = String(order.status || 'pending');
      activities.push({
        id: String(order.id),
        type: 'order',
        title: `订单 ${order.order_no}`,
        description: `${order.customer_name || '未知客户'} · ${statusLabels[status] || status}`,
        timestamp: String(order.created_at || new Date().toISOString()),
      });
    }

    // 经销商活动
    for (const dealer of recentDealers) {
      activities.push({
        id: String(dealer.id),
        type: 'dealer',
        title: '新增经销商',
        description: String(dealer.name || '未命名经销商'),
        timestamp: String(dealer.created_at || new Date().toISOString()),
      });
    }

    // 客户活动
    for (const customer of recentCustomers) {
      activities.push({
        id: String(customer.id),
        type: 'customer',
        title: '新客户',
        description: String(customer.name || '未命名客户'),
        timestamp: String(customer.created_at || new Date().toISOString()),
      });
    }

    // 任务活动
    for (const task of recentTasks) {
      activities.push({
        id: String(task.id),
        type: 'task',
        title: `任务: ${task.title}`,
        description: `状态: ${statusLabels[String(task.status)] || task.status || '未知'}`,
        timestamp: String(task.created_at || new Date().toISOString()),
      });
    }

    // 按时间排序，最新的在前
    activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // 取最近的15条
    const recentActivities = activities.slice(0, 15);

    return NextResponse.json({ success: true, data: recentActivities });
  } catch (err) {
    console.error('Dashboard recent activity error:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
