'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCards, type KpiData } from './components/kpi-cards';
import { TrendChart } from './components/trend-chart';
import { RecentActivity } from './components/recent-activity';
import { OrderStatusChart } from './components/order-status-chart';
import { KpiSkeleton } from './components/skeletons';
import { RefreshCw, LayoutDashboard, Clock } from 'lucide-react';

export default function DashboardPage() {
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // 避免 hydration 错误：动态时间在客户端挂载后渲染
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleString('zh-CN'));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('zh-CN'));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchKpis = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setKpiLoading(true);
    try {
      const res = await fetch('/api/dashboard/kpis');
      if (res.ok) {
        const result = await res.json();
        setKpiData(result.data);
      }
    } catch (err) {
      console.error('Fetch KPIs error:', err);
    } finally {
      setKpiLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  const handleRefresh = () => {
    fetchKpis(true);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <LayoutDashboard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">数字看板</h1>
                <p className="text-sm text-muted-foreground mt-0.5">实时查看生产管理系统各项数据</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {mounted && (
                <Badge variant="outline" className="gap-1.5 text-xs font-normal">
                  <Clock className="h-3 w-3" />
                  {currentTime}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          {kpiLoading ? <KpiSkeleton /> : kpiData && <KpiCards data={kpiData} />}

          {/* Charts and Activity Row */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
            {/* Trend Chart */}
            <div className="lg:col-span-4">
              <TrendChart />
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-3">
              <RecentActivity />
            </div>
          </div>

          {/* Order Status Chart */}
          <OrderStatusChart />
        </div>
      </main>
    </div>
  );
}
