'use client';

import { useState, useEffect, useCallback, useOptimistic, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FactoryList } from './components/factory-list';
import { FactoryToolbar } from './components/factory-toolbar';
import { CreateFactoryButton } from './components/create-button';
import {
  WorkshopData,
  WorkshopStats,
  WorkshopsResponse,
  WorkshopStatusType,
  statusConfig,
} from './schemas';
import {
  Building2,
  CheckCircle2,
  Wrench,
  OctagonX,
  Gauge,
  Activity,
  Loader2,
} from 'lucide-react';

export type ViewMode = 'card' | 'table';

const STATUS_DISPLAY = {
  normal: { label: '正常运行', color: 'bg-emerald-500', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  maintenance: { label: '检修中', color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  stopped: { label: '已停工', color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
} as const;

export function getWorkshopStatusConfig(status: WorkshopStatusType) {
  return STATUS_DISPLAY[status] ?? STATUS_DISPLAY.normal;
}

export default function WorkshopManagementPage() {
  const [workshops, setWorkshops] = useState<WorkshopData[]>([]);
  const [stats, setStats] = useState<WorkshopStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [isPending, startTransition] = useTransition();
  const [optimisticWorkshops, updateOptimisticWorkshops] = useOptimistic(
    workshops,
    (state, { id, status }: { id: string; status: string }) =>
      state.map((w) => (w.id === id ? { ...w, status: status as WorkshopStatusType } : w))
  );

  const fetchWorkshops = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (keyword.trim()) params.set('keyword', keyword.trim());

      const res = await fetch(`/api/factory/workshops?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: WorkshopsResponse = await res.json();
      setWorkshops(data.workshops);
      setStats(data.stats);
    } catch {
      console.error('Failed to fetch workshops');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, keyword]);

  useEffect(() => {
    fetchWorkshops();
  }, [fetchWorkshops]);

  const handleStatusToggle = async (id: string, newStatus: string) => {
    startTransition(async () => {
      updateOptimisticWorkshops({ id, status: newStatus });
      try {
        const res = await fetch(`/api/factory/workshops/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error('Failed to update status');
        // Re-fetch to get the latest stats
        await fetchWorkshops();
      } catch {
        // Revert on error by re-fetching
        await fetchWorkshops();
      }
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/factory/workshops/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        console.error('删除失败:', data.error || '未知错误');
        return;
      }
      await fetchWorkshops();
    } catch {
      console.error('Failed to delete workshop');
    }
  };

  const overallLoadRate = stats && stats.totalCapacity > 0
    ? Math.round((stats.totalLoad / stats.totalCapacity) * 100)
    : 0;

  const loadRateColor = overallLoadRate >= 90 ? 'text-red-600' : overallLoadRate >= 70 ? 'text-amber-600' : 'text-emerald-600';
  const loadRateBarColor = overallLoadRate >= 90 ? '[&>div]:bg-red-500' : overallLoadRate >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500';

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>工厂管理</span>
            <span>/</span>
            <span className="text-foreground font-medium">车间管理</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">车间管理</h1>
          <p className="text-sm text-muted-foreground">管理旗下工厂车间、产能及运行状态</p>
        </div>
        <CreateFactoryButton onSuccess={fetchWorkshops} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">车间总数</p>
                <p className="text-2xl font-bold mt-1">{stats?.total ?? '-'}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building2 className="h-4.5 w-4.5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">正常运行</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{stats?.normal ?? '-'}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">检修中</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{stats?.maintenance ?? '-'}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Wrench className="h-4.5 w-4.5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">已停工</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{stats?.stopped ?? '-'}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center">
                <OctagonX className="h-4.5 w-4.5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">总日产能</p>
                <p className="text-2xl font-bold mt-1">{stats?.totalCapacity?.toLocaleString() ?? '-'}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
                <Gauge className="h-4.5 w-4.5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">综合负荷率</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-2xl font-bold ${loadRateColor}`}>{overallLoadRate}</span>
                  <span className={`text-sm ${loadRateColor}`}>%</span>
                </div>
                <Progress value={overallLoadRate} className={`h-1.5 mt-2 ${loadRateBarColor}`} />
              </div>
              <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center ml-2">
                <Activity className="h-4.5 w-4.5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <FactoryToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        keyword={keyword}
        onKeywordChange={setKeyword}
      />

      {/* Content */}
      {loading && !isPending ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <FactoryList
          data={optimisticWorkshops}
          viewMode={viewMode}
          onStatusToggle={handleStatusToggle}
          onDelete={handleDelete}
          isPending={isPending}
          onEditSuccess={fetchWorkshops}
        />
      )}
    </div>
  );
}
