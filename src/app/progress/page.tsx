'use client';

import { useState, useCallback, useOptimistic, useEffect } from 'react';
import { ProgressBoard } from './components/progress-board';
import { ProgressToolbar, type ProgressFilter } from './components/progress-toolbar';
import { ProgressUpdateSheet } from './components/progress-update';
import { ProgressDetailSheet } from './components/progress-detail';
import { StatsWidgets } from './components/stats-widgets';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import type { WorkOrder, ProgressStats } from './schemas';

const defaultStats: ProgressStats = {
  total: 0,
  pending: 0,
  producing: 0,
  inspecting: 0,
  stored: 0,
  aborted: 0,
  overdue: 0,
};

export default function ProgressPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState<ProgressStats>(defaultStats);
  const [workshops, setWorkshops] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ProgressFilter>({
    keyword: '',
    status: 'all',
    workshop_id: 'all',
    priority: 'all',
  });

  // Stats active filter
  const [statsFilter, setStatsFilter] = useState<string>('all');

  // Sheet states
  const [updateSheetOpen, setUpdateSheetOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  // Optimistic update
  const [optimisticOrders, addOptimisticUpdate] = useOptimistic<
    WorkOrder[],
    { workOrderId: string; completedDelta: number }
  >(workOrders, (state, update) => {
    return state.map((wo) => {
      if (wo.id === update.workOrderId) {
        return {
          ...wo,
          completed_quantity: wo.completed_quantity + update.completedDelta,
        };
      }
      return wo;
    });
  });

  // Fetch work orders
  const fetchWorkOrders = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams();
      if (filter.keyword) params.set('keyword', filter.keyword);
      if (filter.status && filter.status !== 'all') params.set('status', filter.status);
      if (filter.workshop_id && filter.workshop_id !== 'all') params.set('workshop_id', filter.workshop_id);
      if (filter.priority && filter.priority !== 'all') params.set('priority', filter.priority);

      const res = await fetch(`/api/progress/work-orders?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setWorkOrders(result.data || []);
        setStats(result.stats || defaultStats);
      }
    } catch (err) {
      console.error('获取工单失败:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  // Fetch workshops
  const fetchWorkshops = useCallback(async () => {
    try {
      const res = await fetch('/api/progress/workshops');
      const result = await res.json();
      if (result.success) {
        setWorkshops(result.data || []);
      }
    } catch (err) {
      console.error('获取车间列表失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  useEffect(() => {
    fetchWorkshops();
  }, [fetchWorkshops]);

  // Handle progress report submission
  const handleProgressSubmit = useCallback(
    async (data: {
      work_order_id: string;
      action: string;
      completed_delta: number;
      remark: string;
    }) => {
      // Optimistic update
      addOptimisticUpdate({
        workOrderId: data.work_order_id,
        completedDelta: data.completed_delta,
      });

      try {
        const res = await fetch('/api/progress/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();

        if (!result.success) {
          throw new Error(result.error || '上报失败');
        }

        // Refresh data to get server-side state
        await fetchWorkOrders(true);
      } catch (err) {
        console.error('进度上报失败:', err);
        // Rollback by refreshing
        await fetchWorkOrders(true);
        throw err;
      }
    },
    [addOptimisticUpdate, fetchWorkOrders]
  );

  // Handle update button click
  const handleUpdate = useCallback((wo: WorkOrder) => {
    setSelectedWorkOrder(wo);
    setUpdateSheetOpen(true);
  }, []);

  // Handle view detail
  const handleViewDetail = useCallback((wo: WorkOrder) => {
    setSelectedWorkOrder(wo);
    setDetailSheetOpen(true);
  }, []);

  // Handle stats filter click
  const handleStatsFilter = useCallback((status: string) => {
    setStatsFilter(status);
    if (status === 'all') {
      setFilter((prev) => ({ ...prev, status: 'all' }));
    } else if (status === 'overdue') {
      // Overdue is not a status, show all producing/inspecting with overdue
      setFilter((prev) => ({ ...prev, status: 'all' }));
    } else {
      setFilter((prev) => ({ ...prev, status }));
    }
  }, []);

  return (
    <div className="p-6 space-y-5 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">生产进度</h1>
          <p className="text-muted-foreground text-sm">追踪车间排产执行情况与交付进度</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => fetchWorkOrders(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            创建工单
          </Button>
        </div>
      </div>

      {/* Stats */}
      <StatsWidgets
        stats={stats}
        activeFilter={statsFilter}
        onFilterClick={handleStatsFilter}
      />

      {/* Toolbar */}
      <ProgressToolbar
        workshops={workshops}
        filter={filter}
        onFilterChange={setFilter}
      />

      {/* Board */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Spinner className="h-6 w-6 mb-2" />
            <p className="text-sm">加载工单数据...</p>
          </div>
        ) : (
          <ProgressBoard
            data={optimisticOrders}
            onUpdate={handleUpdate}
            onViewDetail={handleViewDetail}
          />
        )}
      </div>

      {/* Sheets */}
      <ProgressUpdateSheet
        open={updateSheetOpen}
        onOpenChange={setUpdateSheetOpen}
        workOrder={selectedWorkOrder}
        onSubmit={handleProgressSubmit}
      />

      <ProgressDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        workOrder={selectedWorkOrder}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
