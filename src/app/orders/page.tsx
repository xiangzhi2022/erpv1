'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ORDER_MODE_CONFIG, type OrderMode } from '@/lib/order-flow';
import { CreateOrderDialog } from './components/create-order-dialog';
import { OrderDetailsSheet } from './components/order-details-sheet';
import { OrderFilters } from './components/order-filters';
import { OrderStatsCards } from './components/order-stats-cards';
import { OrderTable } from './components/order-table';
import { OrdersPageSkeleton } from './components/orders-skeleton';
import { ReturnOrderDialog } from './components/return-order-dialog';
import { ORDER_TABS, type Order, type OrderPageContext, type OrderStats } from './schemas';

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

const defaultContext: OrderPageContext = {
  mode: 'dealer',
  visibleModes: ['dealer'],
  canCreate: false,
  title: ORDER_MODE_CONFIG.dealer.title,
  description: ORDER_MODE_CONFIG.dealer.description,
  createLabel: ORDER_MODE_CONFIG.dealer.createLabel,
  partnerLabel: ORDER_MODE_CONFIG.dealer.partnerLabel,
};

function modeLabel(mode: OrderMode): string {
  if (mode === 'dealer') return '经销商订单';
  if (mode === 'factory_received') return '经销商来单';
  if (mode === 'factory_material') return '材料采购单';
  return '材料商收单';
}

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') as OrderMode | null;

  const [orders, setOrders] = useState<Order[]>([]);
  const [parentOrders, setParentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<OrderPageContext>(defaultContext);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<OrderStats>(defaultStats);
  const [activeMode, setActiveMode] = useState<OrderMode | null>(initialMode);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return tab && ORDER_TABS.some((item) => item.value === tab) ? tab : 'all';
  });
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeMode) params.set('mode', activeMode);
      const currentTab = ORDER_TABS.find((tab) => tab.value === activeTab);
      if (currentTab && currentTab.statuses.length > 0) params.set('status', currentTab.statuses.join(','));
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));

      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setOrders(data.data || []);
        setPagination(data.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 });
        setStats(data.stats || defaultStats);
        setContext(data.context || defaultContext);
        if (!activeMode && data.context?.mode) setActiveMode(data.context.mode);
      } else {
        toast.error(data.error || '获取订单失败');
      }
    } catch {
      toast.error('获取订单失败');
    } finally {
      setLoading(false);
    }
  }, [activeMode, activeTab, pagination.page, pagination.pageSize, search]);

  const fetchParentOrders = useCallback(async () => {
    if (context.mode !== 'factory_material') return;
    try {
      const response = await fetch('/api/orders?mode=factory_received&pageSize=100');
      const data = await response.json();
      if (data.success) setParentOrders(data.data || []);
    } catch {
      setParentOrders([]);
    }
  }, [context.mode]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchParentOrders();
  }, [fetchParentOrders]);

  const handleModeChange = (mode: string) => {
    const nextMode = mode as OrderMode;
    setActiveMode(nextMode);
    setActiveTab('all');
    setPagination((prev) => ({ ...prev, page: 1 }));
    const params = new URLSearchParams(searchParams);
    params.set('mode', nextMode);
    params.delete('tab');
    router.replace(`/orders?${params.toString()}`, { scroll: false });
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
    const params = new URLSearchParams(searchParams);
    if (activeMode) params.set('mode', activeMode);
    params.set('tab', value);
    router.replace(`/orders?${params.toString()}`, { scroll: false });
  };

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const handleStatusChange = async (orderId: string, status: string, notes?: string) => {
    if (status === 'returned') {
      const order = orders.find((item) => item.id === orderId);
      if (order) {
        setSelectedOrder(order);
        setReturnOpen(true);
      }
      return;
    }

    setStatusLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('订单状态已更新');
        await fetchOrders();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleReturnSubmit = async (reason: string) => {
    if (!selectedOrder) return;
    setStatusLoading(true);
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'returned', notes: reason }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('订单已退回');
        setReturnOpen(false);
        await fetchOrders();
      } else {
        toast.error(data.error || '退回失败');
      }
    } catch {
      toast.error('退回失败');
    } finally {
      setStatusLoading(false);
    }
  };

  const getTabCount = (tabValue: string): number => {
    const tab = ORDER_TABS.find((item) => item.value === tabValue);
    if (!tab || tab.statuses.length === 0) return stats.total;
    return tab.statuses.reduce((sum, status) => sum + (stats[status as keyof OrderStats] || 0), 0);
  };

  if (loading && orders.length === 0) return <OrdersPageSkeleton />;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{context.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{context.description}</p>
          </div>
          {context.canCreate && context.createLabel ? (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {context.createLabel}
            </Button>
          ) : null}
        </div>

        {context.visibleModes.length > 1 ? (
          <Tabs value={context.mode} onValueChange={handleModeChange}>
            <TabsList className="h-auto bg-muted/60 p-1">
              {context.visibleModes.map((mode) => (
                <TabsTrigger key={mode} value={mode} className="text-sm">
                  {modeLabel(mode)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}

        <OrderStatsCards stats={stats} loading={loading} />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="h-auto bg-muted/60 p-1">
            {ORDER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-sm">
                {tab.label}
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-xs">
                  {getTabCount(tab.value)}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <OrderFilters search={search} onSearchChange={setSearch} />

        <OrderTable
          orders={orders}
          mode={context.mode}
          loading={loading}
          pagination={pagination}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          onPageSizeChange={(pageSize) => setPagination((prev) => ({ ...prev, pageSize, page: 1 }))}
          onViewDetail={handleViewDetail}
          onStatusChange={handleStatusChange}
        />
      </div>

      <CreateOrderDialog
        open={createOpen}
        mode={context.mode}
        partnerLabel={context.partnerLabel || '接收企业'}
        parentOrders={parentOrders}
        onOpenChange={setCreateOpen}
        onSuccess={fetchOrders}
      />

      <OrderDetailsSheet
        order={selectedOrder}
        mode={context.mode}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={(orderId, status) => handleStatusChange(orderId, status)}
      />

      <ReturnOrderDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        orderNo={selectedOrder?.order_no || ''}
        onSubmit={handleReturnSubmit}
        loading={statusLoading}
      />
    </>
  );
}
