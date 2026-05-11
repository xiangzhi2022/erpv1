import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';

type Row = Record<string, unknown>;
type DashboardUser = {
  id?: string;
  role?: string;
  tenant_id?: string;
};

async function safeRows<T extends Row>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn(`Dashboard activity fallback for ${label}:`, error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`Dashboard activity fallback for ${label}:`, error);
    return [];
  }
}

interface ActivityItem {
  id: string;
  type: 'order' | 'tenant' | 'customer' | 'task' | 'shipping';
  title: string;
  description: string;
  timestamp: string;
  operatorName?: string;
}

export async function GET(request: Request) {
  try {
    const user = (await getUserFromRequest(request)) as DashboardUser | null;
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const isAdmin = isSuperAdmin(user);
    const orderFilter = !isAdmin && user.tenant_id ? { tenant_id: user.tenant_id } : {};

    // 并行获取各类最近活动
    const [recentOrders, recentTenants, recentCustomers, recentTasks, recentShippings] =
      await Promise.all([
        safeRows(
          'orders',
          supabase
            .from('orders')
            .select('id, order_no, customer_name, status, created_at')
            .match(orderFilter)
            .order('created_at', { ascending: false })
            .limit(5)
        ),
        safeRows(
          'tenants',
          supabase
            .from('tenants')
            .select('id, name, company_name, tenant_type, created_at')
            .order('created_at', { ascending: false })
            .limit(3)
        ),
        safeRows(
          'customers',
          supabase
            .from('customers')
            .select('id, name, created_at')
            .order('created_at', { ascending: false })
            .limit(3)
        ),
        safeRows(
          'tasks',
          supabase
            .from('tasks')
            .select('id, title, status, created_at')
            .order('created_at', { ascending: false })
            .limit(3)
        ),
        safeRows(
          'shipping',
          supabase
            .from('shipping')
            .select('id, shipping_no, status, created_at')
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
      activities.push({
        id: String(order.id),
        type: 'order',
        title: `订单 ${order.order_no}`,
        description: `${order.customer_name || '未知客户'} · ${statusLabels[order.status] || order.status}`,
        timestamp: String(order.created_at || new Date().toISOString()),
      });
    }

    // 租户活动
    const tenantTypeLabels: Record<string, string> = {
      dealer: '经销商',
      manufacturer: '生产商',
      material_supplier: '材料商',
    };

    for (const tenant of recentTenants) {
      activities.push({
        id: String(tenant.id),
        type: 'tenant',
        title: `${tenantTypeLabels[String(tenant.tenant_type)] || '租户'}注册`,
        description: String(tenant.company_name || tenant.name || '未命名租户'),
        timestamp: String(tenant.created_at || new Date().toISOString()),
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

    // 发货活动
    for (const shipping of recentShippings) {
      activities.push({
        id: String(shipping.id),
        type: 'shipping',
        title: `发货 ${shipping.shipping_no}`,
        description: `${statusLabels[String(shipping.status)] || shipping.status || '未知'}`,
        timestamp: String(shipping.created_at || new Date().toISOString()),
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
