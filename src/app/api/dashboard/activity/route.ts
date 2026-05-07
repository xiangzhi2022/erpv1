import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';

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

interface ActivityItem {
  id: string;
  type: 'order' | 'tenant' | 'customer' | 'task' | 'shipping';
  title: string;
  description: string;
  timestamp: string;
  operatorName?: string;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseServiceClient();

    // 并行获取各类最近活动
    const [recentOrders, recentTenants, recentCustomers, recentTasks, recentShippings] =
      await Promise.all([
        supabase
          .from('orders')
          .select('id, order_no, customer_name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('tenants')
          .select('id, company_name, tenant_type, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('customers')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('tasks')
          .select('id, title, status, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('shipping')
          .select('id, shipping_no, status, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
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

    for (const order of recentOrders.data || []) {
      activities.push({
        id: order.id,
        type: 'order',
        title: `订单 ${order.order_no}`,
        description: `${order.customer_name || '未知客户'} · ${statusLabels[order.status] || order.status}`,
        timestamp: order.created_at,
      });
    }

    // 租户活动
    const tenantTypeLabels: Record<string, string> = {
      dealer: '经销商',
      manufacturer: '生产商',
      material_supplier: '材料商',
    };

    for (const tenant of recentTenants.data || []) {
      activities.push({
        id: tenant.id,
        type: 'tenant',
        title: `${tenantTypeLabels[tenant.tenant_type] || '租户'}注册`,
        description: tenant.company_name,
        timestamp: tenant.created_at,
      });
    }

    // 客户活动
    for (const customer of recentCustomers.data || []) {
      activities.push({
        id: customer.id,
        type: 'customer',
        title: '新客户',
        description: customer.name,
        timestamp: customer.created_at,
      });
    }

    // 任务活动
    for (const task of recentTasks.data || []) {
      activities.push({
        id: task.id,
        type: 'task',
        title: `任务: ${task.title}`,
        description: `状态: ${statusLabels[task.status] || task.status}`,
        timestamp: task.created_at,
      });
    }

    // 发货活动
    for (const shipping of recentShippings.data || []) {
      activities.push({
        id: shipping.id,
        type: 'shipping',
        title: `发货 ${shipping.shipping_no}`,
        description: `${statusLabels[shipping.status] || shipping.status}`,
        timestamp: shipping.created_at,
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
