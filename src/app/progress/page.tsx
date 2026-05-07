'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Search, RotateCcw } from 'lucide-react';

interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivery_date?: string;
}

const statusColors: Record<string, string> = {
  '已完成': 'bg-green-500',
  '生产中': 'bg-blue-500',
  '刚启动': 'bg-orange-500',
  '待排产': 'bg-gray-500',
  pending: 'bg-orange-500',
  confirmed: 'bg-blue-500',
  producing: 'bg-yellow-500',
  shipped: 'bg-green-500',
  completed: 'bg-emerald-500',
};

const statusLabels: Record<string, string> = {
  pending: '待排产',
  confirmed: '刚启动',
  producing: '生产中',
  shipped: '已发货',
  completed: '已完成',
  returned: '已退回',
  cancelled: '已取消',
};

export default function ProgressPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOrderNo, setSearchOrderNo] = useState('');
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('获取订单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 只显示有进度的订单（非待接收、非已退回）
  const progressOrders = orders
    .filter(o => !['pending', 'returned', 'cancelled'].includes(o.status))
    .filter(o => {
      if (searchOrderNo.trim() && !o.order_no?.includes(searchOrderNo.trim())) return false;
      if (searchName.trim() && !o.customer_name?.includes(searchName.trim())) return false;
      return true;
    });

  // 模拟进度计算（基于状态）
  const getProgress = (status: string): number => {
    switch (status) {
      case 'confirmed': return 15;
      case 'producing': return 55;
      case 'shipped': return 85;
      case 'completed': return 100;
      default: return 5;
    }
  };

  const handleReset = () => {
    setSearchOrderNo('');
    setSearchName('');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">进度管理</h1>
              <p className="text-muted-foreground mt-1">跟踪和管理生产进度</p>
            </div>
            <Button variant="outline" onClick={fetchOrders}>刷新数据</Button>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>订单编号</Label>
                  <Input
                    placeholder="请输入订单编号"
                    value={searchOrderNo}
                    onChange={(e) => setSearchOrderNo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>客户名称</Label>
                  <Input
                    placeholder="请输入客户名称"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-1" /> 重置
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>生产进度列表</CardTitle>
                <span className="text-sm text-muted-foreground">共 {progressOrders.length} 条</span>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : progressOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无进度数据</p>
                  <Button variant="outline" className="mt-4" onClick={() => router.push('/orders')}>
                    去查看订单
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {progressOrders.map((order) => {
                    const progress = getProgress(order.status);
                    const statusLabel = statusLabels[order.status] || order.status;
                    return (
                      <div
                        key={order.id}
                        className="border rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
                        onClick={() => router.push(`/orders?status=${order.status}`)}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{order.order_no}</span>
                            <span className="font-medium">{order.customer_name || '-'}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${statusColors[order.status] || 'bg-gray-500'}`}>
                              {statusLabel}
                            </span>
                            <span className="text-sm text-muted-foreground">{progress}%</span>
                          </div>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                          <span>创建时间：{order.created_at ? new Date(order.created_at).toLocaleDateString('zh-CN') : '-'}</span>
                          <span>交付日期：{order.delivery_date || '待定'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
