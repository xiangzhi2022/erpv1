'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Package, Clock, CheckCircle2, TrendingUp, RotateCcw, Eye } from 'lucide-react';

interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivery_date?: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: '待接收', color: 'bg-orange-100 text-orange-700' },
  returned: { label: '已退回', color: 'bg-red-100 text-red-700' },
  confirmed: { label: '已接收', color: 'bg-blue-100 text-blue-700' },
  producing: { label: '生产中', color: 'bg-yellow-100 text-yellow-700' },
  pool: { label: '订单池', color: 'bg-purple-100 text-purple-700' },
  shipped: { label: '已发货', color: 'bg-green-100 text-green-700' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-700' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    fetchOrders();
    setCurrentTime(new Date().toLocaleString('zh-CN'));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('zh-CN'));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('获取订单数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 从真实数据计算统计
  const stats = [
    {
      title: '待接收订单',
      value: orders.filter(o => o.status === 'pending').length,
      filter: 'pending',
      icon: FileText,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: '退回订单',
      value: orders.filter(o => o.status === 'returned').length,
      filter: 'returned',
      icon: RotateCcw,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: '未排产订单池',
      value: orders.filter(o => o.status === 'confirmed' || o.status === 'pool').length,
      filter: 'confirmed',
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: '生产中订单',
      value: orders.filter(o => o.status === 'producing').length,
      filter: 'producing',
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: '当月完工单量',
      value: orders.filter(o => o.status === 'completed' || o.status === 'shipped').length,
      filter: 'completed',
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ];

  const recentOrders = orders.slice(0, 10);

  const handleStatClick = (filter: string) => {
    router.push(`/orders?status=${filter}`);
  };

  const handleViewDetail = (orderId: string) => {
    router.push(`/orders?id=${orderId}`);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">数字看板</h1>
              <p className="text-muted-foreground mt-1">实时查看生产管理系统各项数据</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>数据更新时间：{currentTime}</span>
              <Button variant="ghost" size="sm" onClick={fetchOrders} className="ml-2">
                刷新
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-10 w-16 mb-2" />
                    <Skeleton className="h-4 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : (
              stats.map((stat) => (
                <Card
                  key={stat.title}
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleStatClick(stat.filter)}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold">{stat.value}</div>
                    <Button variant="link" className="p-0 h-auto text-sm text-primary mt-2">
                      查看明细
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>订单状态一览</CardTitle>
                  <CardDescription>最近的生产订单状态</CardDescription>
                </div>
                <Button variant="outline" onClick={() => router.push('/orders')}>
                  查看全部订单
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无订单数据</p>
                  <Button variant="outline" className="mt-4" onClick={() => router.push('/orders')}>
                    去创建订单
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">序号</th>
                        <th className="text-left py-3 px-4 font-medium">订单编号</th>
                        <th className="text-left py-3 px-4 font-medium">客户名称</th>
                        <th className="text-left py-3 px-4 font-medium">下单日期</th>
                        <th className="text-left py-3 px-4 font-medium">状态</th>
                        <th className="text-left py-3 px-4 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order, index) => {
                        const cfg = statusConfig[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' };
                        return (
                          <tr key={order.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4">{index + 1}</td>
                            <td className="py-3 px-4 font-mono text-sm">{order.order_no}</td>
                            <td className="py-3 px-4">{order.customer_name || '-'}</td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {order.created_at ? new Date(order.created_at).toLocaleString('zh-CN') : '-'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <Button
                                variant="link"
                                className="text-primary p-0 h-auto text-sm"
                                onClick={() => handleViewDetail(order.id)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                查看详情
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
