'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, Package, Clock, Truck, CheckCircle2 } from 'lucide-react';

// Aligned with ORDER_STATUS_CONFIG in orders/schemas.ts
interface OrderStats {
  total: number;
  pending: number;
  returned: number;
  confirmed: number;
  pool: number;
  producing: number;
  shipped: number;
  completed: number;
  cancelled: number;
}

interface Order {
  id: string;
  order_no: string;
  status: string;
  total_amount: number;
  created_at: string;
  customer_name: string;
}

const defaultStats: OrderStats = {
  total: 0,
  pending: 0,
  returned: 0,
  confirmed: 0,
  pool: 0,
  producing: 0,
  shipped: 0,
  completed: 0,
  cancelled: 0,
};

export default function BoardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOrders(data.data || []);
          setStats(data.stats || defaultStats);
        }
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Producing count includes both 'producing' and 'in_production' statuses
  const producingCount = stats.producing + orders.filter(o => o.status === 'in_production').length;

  const dailyStats = [
    {
      label: '今日订单',
      value: stats.total,
      change: stats.total > 0 ? `总${stats.total}单` : '',
      trend: 'up' as const,
      icon: Package,
      color: 'text-blue-500',
      href: '/orders',
    },
    {
      label: '生产中',
      value: producingCount,
      change: stats.confirmed > 0 ? `待排${stats.confirmed}单` : '',
      trend: 'up' as const,
      icon: Clock,
      color: 'text-amber-500',
      href: '/progress',
    },
    {
      label: '已发货',
      value: stats.shipped,
      change: stats.shipped > 0 ? `累计${stats.shipped}单` : '',
      trend: 'down' as const,
      icon: Truck,
      color: 'text-purple-500',
      href: '/shipping',
    },
    {
      label: '已完成',
      value: stats.completed,
      change: stats.completed > 0 ? `累计${stats.completed}单` : '',
      trend: 'up' as const,
      icon: CheckCircle2,
      color: 'text-green-500',
      href: '/orders?status=completed',
    },
  ];

  // Compute last 7 days data only after mount to avoid hydration mismatch
  const weeklyData = useMemo(() => {
    if (!mounted) return [];

    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const days: { date: string; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().split('T')[0],
        label: i === 0 ? '今天' : i === 1 ? '昨天' : weekDays[d.getDay()],
      });
    }

    return days.map(day => {
      const dayOrders = orders.filter(o => o.created_at?.startsWith(day.date));
      return {
        day: day.label,
        orders: dayOrders.length,
        production: dayOrders.filter(o => o.status === 'producing' || o.status === 'in_production' || o.status === 'completed').length,
        shipped: dayOrders.filter(o => o.status === 'shipped').length,
      };
    });
  }, [mounted, orders]);

  // Aligned with ORDER_STATUS_CONFIG in orders/schemas.ts
  const statusGroups = [
    { status: 'pending', label: '待接收', count: stats.pending },
    { status: 'confirmed', label: '已接收', count: stats.confirmed },
    { status: 'pool', label: '订单池', count: stats.pool },
    { status: 'producing', label: '生产中', count: producingCount },
    { status: 'shipped', label: '已发货', count: stats.shipped },
    { status: 'completed', label: '已完成', count: stats.completed },
    { status: 'returned', label: '已退回', count: stats.returned },
    { status: 'cancelled', label: '已取消', count: stats.cancelled },
  ];

  const maxOrders = Math.max(...weeklyData.map(d => d.orders), 1);

  // Quality stats are placeholders (not from API)
  const qualityStats = [
    { label: '合格率', value: 98.5, target: 95 },
    { label: '准时交付率', value: 92.3, target: 90 },
    { label: '客户满意度', value: 95.0, target: 85 },
    { label: '返工率', value: 1.5, target: 5 },
  ];

  return (
    <>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">数字看板</h1>
              <p className="text-muted-foreground mt-1">实时数据监控中心</p>
            </div>
            <Button variant="outline" onClick={fetchData}>
              刷新数据
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : (
              dailyStats.map((stat) => (
                <Card
                  key={stat.label}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(stat.href)}
                >
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <div className="flex items-end gap-2 mt-2">
                      <span className="text-3xl font-bold">{stat.value}</span>
                      {stat.change && (
                        <span className={`text-sm flex items-center ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                          {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {stat.change}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">总览</TabsTrigger>
              <TabsTrigger value="production">生产</TabsTrigger>
              <TabsTrigger value="quality">质量</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Weekly Chart */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>近7日订单趋势</CardTitle>
                      <Button variant="link" className="text-sm" onClick={() => router.push('/orders')}>
                        查看全部
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading || !mounted ? (
                      <div className="space-y-4">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {weeklyData.map((data) => (
                          <div key={data.day} className="flex items-center gap-4">
                            <span className="w-12 text-sm text-muted-foreground">{data.day}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs w-16">订单 {data.orders}</span>
                                <Progress value={(data.orders / maxOrders) * 100} className="h-2 flex-1" />
                              </div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs w-16 text-blue-600">生产 {data.production}</span>
                                <Progress value={(data.production / maxOrders) * 100} className="h-2 flex-1 [&>div]:bg-blue-500" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs w-16 text-green-600">发货 {data.shipped}</span>
                                <Progress value={(data.shipped / maxOrders) * 100} className="h-2 flex-1 [&>div]:bg-green-500" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Status Distribution */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>订单状态分布</CardTitle>
                      <Button variant="link" className="text-sm" onClick={() => router.push('/orders')}>
                        查看明细
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-6">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : statusGroups.every(s => s.count === 0) ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>暂无订单数据</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {statusGroups.filter(g => g.count > 0).map((group) => (
                          <div key={group.status}>
                            <div className="flex justify-between mb-2">
                              <span
                                className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                                onClick={() => router.push(`/orders?status=${group.status}`)}
                              >
                                {group.label}
                              </span>
                              <span className="text-sm text-muted-foreground">{group.count} 单</span>
                            </div>
                            <Progress
                              value={stats.total > 0 ? (group.count / stats.total) * 100 : 0}
                              className="h-3 cursor-pointer"
                              onClick={() => router.push(`/orders?status=${group.status}`)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="production">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>生产数据详情</CardTitle>
                    <Button variant="outline" onClick={() => router.push('/progress')}>
                      查看进度管理
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : stats.total === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>暂无生产数据</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {statusGroups.filter(g => g.count > 0).map((group) => (
                        <div
                          key={group.status}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => router.push(`/orders?status=${group.status}`)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{group.label}</p>
                              <p className="text-sm text-muted-foreground">
                                占比 {stats.total > 0 ? ((group.count / stats.total) * 100).toFixed(1) : 0}%
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{group.count}</p>
                            <p className="text-xs text-muted-foreground">订单</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quality">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>质量数据统计</CardTitle>
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                      返回首页
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {qualityStats.map((stat) => (
                      <div key={stat.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{stat.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{stat.value}%</span>
                            <span className="text-xs text-muted-foreground">目标 {stat.target}%</span>
                          </div>
                        </div>
                        <Progress
                          value={stat.value}
                          className="h-3"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className={stat.value >= stat.target ? 'text-green-500' : 'text-red-500'}>
                            {stat.value >= stat.target ? '达标' : '未达标'}
                          </span>
                          <span>差距 {Math.abs(stat.value - stat.target).toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </>
  );
}
