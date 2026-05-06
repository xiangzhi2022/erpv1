'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Order, OrderStats, OrderStatus, ORDER_TABS } from './schemas';
import { OrderStatsCards } from './components/order-stats-cards';
import { OrderTable } from './components/order-table';
import { OrderDetailsSheet } from './components/order-details-sheet';
import { CreateOrderDialog } from './components/create-order-dialog';
import { OrderFilters } from './components/order-filters';
import { ReturnOrderDialog } from './components/return-order-dialog';

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    if (tab && ORDER_TABS.some((t) => t.value === tab)) return tab;
    return 'all';
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnOrderNo, setReturnOrderNo] = useState('');
  const [returnOrderId, setReturnOrderId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const tabConfig = ORDER_TABS.find((t) => t.value === activeTab);
      if (tabConfig && tabConfig.statuses.length > 0) {
        params.set('status', tabConfig.statuses.join(','));
      }
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOrders(data.data || []);
          setStats(data.stats || null);
          setTotalPages(data.pagination?.totalPages || 1);
          setTotal(data.pagination?.total || 0);
        }
      }
    } catch (err) {
      console.error('获取订单失败:', err);
      toast.error('获取订单失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, page, pageSize]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page when tab or search changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  // View order detail
  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailSheetOpen(true);
  };

  // Status change
  const handleStatusChange = async (orderId: string, status: string, notes?: string) => {
    if (status === 'returned') {
      setReturnOrderId(orderId);
      const order = orders.find((o) => o.id === orderId);
      setReturnOrderNo(order?.order_no || '');
      setReturnDialogOpen(true);
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status, notes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(getStatusActionLabel(status));
        // Update the selected order if detail sheet is open
        if (selectedOrder?.id === orderId) {
          setSelectedOrder({ ...selectedOrder, status: status as OrderStatus });
        }
        fetchOrders();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // Return order with reason
  const handleReturnOrder = async (reason: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: returnOrderId, status: 'returned', notes: reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('订单已退回');
        setReturnDialogOpen(false);
        if (selectedOrder?.id === returnOrderId) {
          setSelectedOrder({ ...selectedOrder, status: 'returned' as OrderStatus });
        }
        fetchOrders();
      } else {
        toast.error(data.error || '退回失败');
      }
    } catch {
      toast.error('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // Page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  // Get tab count from stats
  const getTabCount = (tabValue: string): number => {
    if (!stats) return 0;
    const tabConfig = ORDER_TABS.find((t) => t.value === tabValue);
    if (!tabConfig || tabConfig.statuses.length === 0) return stats.total;
    return tabConfig.statuses.reduce((sum, s) => sum + (stats[s as keyof OrderStats] || 0), 0);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">订单管理</h1>
              <p className="text-muted-foreground mt-1">管理生产订单的接收、录入和状态跟踪</p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> 创建订单
            </Button>
          </div>

          {/* Stats Cards */}
          <OrderStatsCards stats={stats} loading={loading} />

          {/* Tabs + Filters + Table */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList className="h-auto p-1 bg-muted">
                {ORDER_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 px-4">
                    {tab.label}
                    {!loading && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] flex items-center justify-center text-xs">
                        {getTabCount(tab.value)}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              <OrderFilters search={search} onSearchChange={setSearch} />
            </div>

            {ORDER_TABS.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                <OrderTable
                  orders={orders}
                  loading={loading}
                  pagination={{ page, pageSize, total, totalPages }}
                  onPageChange={setPage}
                  onPageSizeChange={handlePageSizeChange}
                  onViewDetail={handleViewDetail}
                  onStatusChange={handleStatusChange}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>

      {/* Create Order Dialog */}
      <CreateOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          fetchOrders();
          toast.success('订单创建成功');
        }}
      />

      {/* Order Details Sheet */}
      <OrderDetailsSheet
        order={selectedOrder}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onStatusChange={(orderId, status) => {
          handleStatusChange(orderId, status);
          // Also update selected order
          if (selectedOrder) {
            setSelectedOrder({ ...selectedOrder, status: status as OrderStatus });
          }
        }}
      />

      {/* Return Order Dialog */}
      <ReturnOrderDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        orderNo={returnOrderNo}
        onSubmit={handleReturnOrder}
        loading={actionLoading}
      />
    </div>
  );
}

function getStatusActionLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: '订单已接收',
    returned: '订单已退回',
    pool: '订单已入池',
    producing: '订单开始生产',
    shipped: '订单已发货',
    completed: '订单已完成',
    cancelled: '订单已取消',
  };
  return labels[status] || '操作成功';
}
