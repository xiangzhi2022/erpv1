'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, Search, RotateCcw, Eye, ArrowLeft, Plus } from 'lucide-react';

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

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (initialStatus === 'pending') return 'receive';
    if (initialStatus === 'returned') return 'returned';
    if (initialStatus === 'confirmed') return 'received';
    if (initialStatus === 'producing') return 'pool';
    if (initialStatus === 'completed') return 'pool';
    return 'receive';
  });
  const [searchDealer, setSearchDealer] = useState('');
  const [searchOrder, setSearchOrder] = useState('');
  const [generatedOrderNo, setGeneratedOrderNo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
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

  const filteredOrders = useCallback((statusFilter: string | string[]) => {
    let result = orders;
    if (Array.isArray(statusFilter)) {
      result = result.filter(o => statusFilter.includes(o.status));
    } else if (statusFilter) {
      result = result.filter(o => o.status === statusFilter);
    }
    if (searchDealer.trim()) {
      result = result.filter(o => o.customer_name?.includes(searchDealer.trim()));
    }
    if (searchOrder.trim()) {
      result = result.filter(o => o.order_no?.includes(searchOrder.trim()));
    }
    return result;
  }, [orders, searchDealer, searchOrder]);

  const pendingOrders = filteredOrders('pending');
  const returnedOrders = filteredOrders('returned');
  const confirmedOrders = filteredOrders(['confirmed', 'pool']);
  const producingOrders = filteredOrders(['producing', 'shipped', 'completed']);

  const generateOrderNo = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/orders/generate', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setGeneratedOrderNo(data.orderNo);
      } else {
        alert(data.error || '生成订单号失败');
      }
    } catch {
      alert('生成订单号失败，请重试');
    }
    setIsGenerating(false);
  };

  const handleReceive = async (orderId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: 'confirmed' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
      } else {
        alert(data.error || '操作失败');
      }
    } catch {
      alert('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, status: 'returned', notes: returnReason }),
      });
      const data = await res.json();
      if (data.success) {
        setReturnDialogOpen(false);
        setReturnReason('');
        setSelectedOrder(null);
        fetchOrders();
      } else {
        alert(data.error || '退回失败');
      }
    } catch {
      alert('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const OrderTable = ({ items, showActions }: { items: Order[]; showActions?: 'receive' | 'view' }) => (
    <div className="overflow-x-auto">
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>暂无数据</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 font-medium">序号</th>
              <th className="text-left py-3 px-4 font-medium">订单编号</th>
              <th className="text-left py-3 px-4 font-medium">客户名称</th>
              <th className="text-left py-3 px-4 font-medium">下单日期</th>
              <th className="text-left py-3 px-4 font-medium">状态</th>
              <th className="text-left py-3 px-4 font-medium">备注</th>
              <th className="text-left py-3 px-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((order, index) => {
              const cfg = statusConfig[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' };
              return (
                <tr key={order.id} className="border-b hover:bg-muted/50">
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
                  <td className="py-3 px-4 text-muted-foreground text-sm max-w-[200px] truncate">
                    {order.notes || '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewDetail(order)}>
                        <Eye className="h-3 w-3 mr-1" /> 查看
                      </Button>
                      {showActions === 'receive' && order.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => handleReceive(order.id)} disabled={actionLoading}>
                            接收
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => { setSelectedOrder(order); setReturnDialogOpen(true); }}
                            disabled={actionLoading}
                          >
                            退回
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  const SearchBar = () => (
    <div className="grid gap-4 md:grid-cols-3 mb-6">
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
        <Button variant="outline" onClick={() => { setSearchDealer(''); setSearchOrder(''); }}>
          重置
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">订单管理</h1>
              <p className="text-muted-foreground mt-1">管理生产订单的接收、录入和状态跟踪</p>
            </div>
            <Button onClick={() => router.push('/dealer')} className="gap-2">
              <Plus className="h-4 w-4" />
              创建订单
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-muted">
              <TabsTrigger value="receive">订单接收</TabsTrigger>
              <TabsTrigger value="pending">
                待接收 <Badge variant="secondary" className="ml-1">{pendingOrders.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="returned">已退回</TabsTrigger>
              <TabsTrigger value="received">已接收</TabsTrigger>
              <TabsTrigger value="entry">订单录入</TabsTrigger>
              <TabsTrigger value="pool">未排产订单池</TabsTrigger>
            </TabsList>

            <TabsContent value="receive">
              <Card>
                <CardHeader><CardTitle>订单接收</CardTitle></CardHeader>
                <CardContent>
                  <SearchBar />
                  <OrderTable items={filteredOrders('pending')} showActions="receive" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pending">
              <Card>
                <CardHeader><CardTitle>待接收订单</CardTitle></CardHeader>
                <CardContent>
                  <SearchBar />
                  <OrderTable items={pendingOrders} showActions="receive" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="returned">
              <Card>
                <CardHeader><CardTitle>已退回订单</CardTitle></CardHeader>
                <CardContent>
                  <SearchBar />
                  <OrderTable items={returnedOrders} showActions="view" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="received">
              <Card>
                <CardHeader><CardTitle>已接收订单</CardTitle></CardHeader>
                <CardContent>
                  <SearchBar />
                  <OrderTable items={confirmedOrders} showActions="view" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="entry">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>订单录入</CardTitle>
                    <Button onClick={generateOrderNo} disabled={isGenerating}>
                      {isGenerating ? '生成中...' : '生成订单号'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {generatedOrderNo && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
                      <p className="text-green-800 font-medium">
                        已生成订单号：<span className="font-mono text-lg">{generatedOrderNo}</span>
                      </p>
                      <Button
                        variant="link"
                        className="p-0 h-auto text-green-700 mt-1"
                        onClick={() => router.push('/dealer')}
                      >
                        去创建订单
                      </Button>
                    </div>
                  )}
                  <SearchBar />
                  <OrderTable items={confirmedOrders} showActions="view" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pool">
              <Card>
                <CardHeader><CardTitle>未排产订单池</CardTitle></CardHeader>
                <CardContent>
                  <SearchBar />
                  <OrderTable items={producingOrders} showActions="view" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Order Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>订单详情</DialogTitle>
            <DialogDescription>查看订单详细信息</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">订单编号</Label>
                  <p className="font-mono font-medium">{selectedOrder.order_no}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">状态</Label>
                  <p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${(statusConfig[selectedOrder.status] || { color: 'bg-gray-100 text-gray-700' }).color}`}>
                      {(statusConfig[selectedOrder.status] || { label: selectedOrder.status }).label}
                    </span>
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">客户名称</Label>
                  <p className="font-medium">{selectedOrder.customer_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">金额</Label>
                  <p className="font-medium">¥{(selectedOrder.total_amount / 100).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">创建时间</Label>
                  <p className="text-sm">{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('zh-CN') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">交付日期</Label>
                  <p className="text-sm">{selectedOrder.delivery_date || '-'}</p>
                </div>
              </div>
              {selectedOrder.notes && (
                <div>
                  <Label className="text-muted-foreground">备注</Label>
                  <p className="text-sm mt-1">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>退回订单</DialogTitle>
            <DialogDescription>
              退回订单 {selectedOrder?.order_no}，请填写退回原因
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>退回原因</Label>
              <Input
                placeholder="请输入退回原因"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleReturn} disabled={actionLoading || !returnReason.trim()}>
              {actionLoading ? '处理中...' : '确认退回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
