'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Truck, Package, Plus, RotateCcw } from 'lucide-react';

// Status labels aligned with ORDER_STATUS_CONFIG in orders/schemas.ts
interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivery_date?: string;
  notes?: string;
}

// Shipping-facing status display, aligned with orders module status values
const shippingStatusMap: Record<string, string> = {
  pending: '待发货',
  returned: '已退回',
  confirmed: '待发货',
  pool: '待发货',
  producing: '待发货',
  in_production: '待发货',
  shipped: '已发货',
  completed: '已签收',
  cancelled: '已取消',
};

const statusColors: Record<string, string> = {
  '待发货': 'bg-orange-100 text-orange-700',
  '已发货': 'bg-blue-100 text-blue-700',
  '已签收': 'bg-green-100 text-green-700',
  '已退回': 'bg-red-100 text-red-700',
  '已取消': 'bg-gray-100 text-gray-700',
};

// Orders that are relevant for shipping view
const SHIPPING_VISIBLE_STATUSES = ['confirmed', 'producing', 'in_production', 'shipped', 'completed'];
// Orders that can be shipped (not yet shipped or completed)
const SHIPPABLE_STATUSES = ['confirmed', 'producing', 'in_production'];

export default function ShippingPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [searchDealer, setSearchDealer] = useState('');
  const [searchOrder, setSearchOrder] = useState('');
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [shipOrder, setShipOrder] = useState<Order | null>(null);
  const [trackingNo, setTrackingNo] = useState('');
  const [shippingCompany, setShippingCompany] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOrders(data.data || []);
        }
      }
    } catch (error) {
      console.error('获取订单失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filter orders relevant to shipping
  const shippableOrders = orders.filter(o =>
    SHIPPING_VISIBLE_STATUSES.includes(o.status)
  ).filter(o => {
    if (searchDealer.trim() && !o.customer_name?.includes(searchDealer.trim())) return false;
    if (searchOrder.trim() && !o.order_no?.includes(searchOrder.trim())) return false;
    return true;
  });

  // Format date safely (client-only to avoid hydration mismatch)
  const formatDateSafe = (dateStr: string | null): string => {
    if (!dateStr || !mounted) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const handleShip = async () => {
    if (!shipOrder || !trackingNo.trim()) return;
    setActionLoading(true);
    try {
      // Use PUT /api/orders - same convention as orders module
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: shipOrder.id,
          status: 'shipped',
          notes: `物流公司: ${shippingCompany || '未选择'}, 运单号: ${trackingNo}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShipDialogOpen(false);
        setTrackingNo('');
        setShippingCompany('');
        setShipOrder(null);
        fetchOrders();
      } else {
        alert(data.error || '发货失败');
      }
    } catch {
      alert('发货操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = () => {
    setSearchDealer('');
    setSearchOrder('');
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">发货管理</h1>
              <p className="text-muted-foreground mt-1">管理订单发货和物流跟踪</p>
            </div>
            <Button variant="outline" onClick={fetchOrders}>刷新数据</Button>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>客户名称</Label>
                  <Input
                    placeholder="请输入客户名称"
                    value={searchDealer}
                    onChange={(e) => setSearchDealer(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>订单编号</Label>
                  <Input
                    placeholder="请输入订单编号"
                    value={searchOrder}
                    onChange={(e) => setSearchOrder(e.target.value)}
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

          {/* Shipping List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>发货列表</CardTitle>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 新建发货单
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : shippableOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无发货数据</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">序号</th>
                        <th className="text-left py-3 px-4 font-medium">订单编号</th>
                        <th className="text-left py-3 px-4 font-medium">客户名称</th>
                        <th className="text-left py-3 px-4 font-medium">金额</th>
                        <th className="text-left py-3 px-4 font-medium">创建日期</th>
                        <th className="text-left py-3 px-4 font-medium">发货状态</th>
                        <th className="text-left py-3 px-4 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shippableOrders.map((order, index) => {
                        const shipStatus = shippingStatusMap[order.status] || '待发货';
                        return (
                          <tr key={order.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">{index + 1}</td>
                            <td className="py-3 px-4 font-mono text-sm">{order.order_no}</td>
                            <td className="py-3 px-4">{order.customer_name || '-'}</td>
                            <td className="py-3 px-4">¥{(order.total_amount / 100).toFixed(2)}</td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {formatDateSafe(order.created_at)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[shipStatus] || 'bg-gray-100 text-gray-700'}`}>
                                {shipStatus}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => router.push(`/orders`)}>
                                  查看
                                </Button>
                                {SHIPPABLE_STATUSES.includes(order.status) && (
                                  <Button
                                    size="sm"
                                    onClick={() => { setShipOrder(order); setShipDialogOpen(true); }}
                                  >
                                    <Truck className="h-3 w-3 mr-1" /> 发货
                                  </Button>
                                )}
                              </div>
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

      {/* Ship Dialog */}
      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认发货</DialogTitle>
            <DialogDescription>
              订单 {shipOrder?.order_no}，请填写物流信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>物流公司</Label>
              <Select value={shippingCompany} onValueChange={setShippingCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择物流公司" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="顺丰速运">顺丰速运</SelectItem>
                  <SelectItem value="中通快递">中通快递</SelectItem>
                  <SelectItem value="圆通速递">圆通速递</SelectItem>
                  <SelectItem value="韵达快递">韵达快递</SelectItem>
                  <SelectItem value="德邦物流">德邦物流</SelectItem>
                  <SelectItem value="自提">自提</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>运单号</Label>
              <Input
                placeholder="请输入运单号"
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipDialogOpen(false)}>取消</Button>
            <Button onClick={handleShip} disabled={actionLoading || !trackingNo.trim()}>
              {actionLoading ? '处理中...' : '确认发货'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Shipping Order Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建发货单</DialogTitle>
            <DialogDescription>选择待发货的订单创建发货单</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {orders.filter(o => SHIPPABLE_STATUSES.includes(o.status)).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>暂无可发货订单</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {orders.filter(o => SHIPPABLE_STATUSES.includes(o.status)).map(order => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setShipOrder(order);
                      setCreateDialogOpen(false);
                      setShipDialogOpen(true);
                    }}
                  >
                    <div>
                      <p className="font-mono text-sm">{order.order_no}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                    </div>
                    <Button size="sm">发货</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
