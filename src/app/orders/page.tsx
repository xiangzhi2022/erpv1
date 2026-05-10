'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { OrderStatsCards } from './components/order-stats-cards';
import { OrderTable } from './components/order-table';
import { OrderDetailsSheet } from './components/order-details-sheet';
import { OrderFilters } from './components/order-filters';
import { CreateOrderDialog } from './components/create-order-dialog';
import { ReturnOrderDialog } from './components/return-order-dialog';
import { OrdersPageSkeleton } from './components/orders-skeleton';
import { ORDER_TABS, Order, OrderStats } from './schemas';

// Default stats
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

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OrderStats>(defaultStats);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    if (tab && ORDER_TABS.some((t) => t.value === tab)) return tab;
    return 'all';
  });
  const [search, setSearch] = useState('');

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const currentTab = ORDER_TABS.find((t) => t.value === activeTab);
      if (currentTab && currentTab.statuses.length > 0) {
        params.set('status', currentTab.statuses.join(','));
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));

      const res = await fetch(`/api/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOrders(data.data || []);
          setPagination(data.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 });
          setStats(data.stats || defaultStats);
        }
      }
    } catch (err) {
      console.error('Fetch orders failed:', err);
      toast.error('获取订单失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Sync tab to URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
    const params = new URLSearchParams(searchParams);
    params.set('tab', value);
    router.replace(`/orders?${params.toString()}`, { scroll: false });
  };

  // View order detail
  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  // Status change handler
  const handleStatusChange = async (orderId: string, status: string, notes?: string) => {
    if (status === 'returned') {
      // Open return dialog
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
        setReturnOpen(true);
      }
      return;
    }

    setStatusLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status, notes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`订单状态已更新为${getStatusLabel(status)}`);
        // Update local state optimistically
        const newStatus = status as import('./schemas').OrderStatus;
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus, updated_at: new Date().toISOString() } : o))
        );
        setSelectedOrder((prev) =>
          prev && prev.id === orderId ? { ...prev, status: newStatus, updated_at: new Date().toISOString() } : prev
        );
        // Refresh stats
        fetchOrders();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setStatusLoading(false);
    }
  };

  // Handle return with reason
  const handleReturnSubmit = async (reason: string) => {
    if (!selectedOrder) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, status: 'returned', notes: reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('订单已退回');
        setOrders((prev) =>
          prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: 'returned' as const, remark: reason, updated_at: new Date().toISOString() } : o))
        );
        setSelectedOrder((prev) =>
          prev && prev.id === selectedOrder.id ? { ...prev, status: 'returned' as const, remark: reason, updated_at: new Date().toISOString() } : prev
        );
        setReturnOpen(false);
        fetchOrders();
      } else {
        toast.error(data.error || '退回失败');
      }
    } catch {
      toast.error('退回操作失败');
    } finally {
      setStatusLoading(false);
    }
  };

  // Get tab badge count from stats
  const getTabCount = (tabValue: string): number => {
    const tab = ORDER_TABS.find((t) => t.value === tabValue);
    if (!tab || tab.statuses.length === 0) return stats.total;
    return tab.statuses.reduce((sum, s) => sum + (stats[s as keyof OrderStats] || 0), 0);
  };

  // Get status label
  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: '待接收',
      returned: '已退回',
      confirmed: '已接收',
      pool: '订单池',
      producing: '生产中',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消',
    };
    return labels[status] || status;
  };

  // Show full-page skeleton on initial load
  if (loading && orders.length === 0) {
    return <OrdersPageSkeleton />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">订单管理</h1>
              <p className="text-muted-foreground text-sm mt-1">
                管理生产订单的接收、录入和状态跟踪
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              创建订单
            </Button>
          </div>

          {/* Stats Cards */}
          <OrderStatsCards stats={stats} loading={loading} />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="h-auto p-1 bg-muted/60">
              {ORDER_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-sm">
                  {tab.label}
                  <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] text-xs px-1.5">
                    {getTabCount(tab.value)}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Search & Filters */}
          <OrderFilters search={search} onSearchChange={setSearch} />

          {/* Order Table */}
          <OrderTable
            orders={orders}
            loading={loading}
            pagination={pagination}
            onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
            onPageSizeChange={(size) => setPagination((prev) => ({ ...prev, pageSize: size, page: 1 }))}
            onViewDetail={handleViewDetail}
            onStatusChange={handleStatusChange}
          />
        </div>
      </main>

      {/* Create Order Dialog */}
      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          fetchOrders();
          toast.success('订单创建成功');
        }}
      />

      {/* Order Detail Sheet */}
      <OrderDetailsSheet
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={(orderId, status) => handleStatusChange(orderId, status)}
      />

      {/* Return Order Dialog */}
      <ReturnOrderDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        orderNo={selectedOrder?.order_no || ''}
        onSubmit={handleReturnSubmit}
        loading={statusLoading}
      />
    </div>
  );
}
