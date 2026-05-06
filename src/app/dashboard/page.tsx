'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { KpiCards, type KpiData } from './components/kpi-cards';
import { TrendChart } from './components/trend-chart';
import { RecentActivity } from './components/recent-activity';
import { OrderStatusChart } from './components/order-status-chart';
import { KpiSkeleton } from './components/skeletons';
import { RefreshCw, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [mounted, setMounted] = useState(false);

  // 避免 hydration 错误：动态时间在客户端挂载后渲染
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleString('zh-CN'));
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('zh-CN'));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchKpis = useCallback(async () => {
    setKpiLoading(true);
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
    }
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">数字看板</h1>
              <p className="text-muted-foreground mt-1">实时查看生产管理系统各项数据</p>
            </div>
            <div className="flex items-center gap-3">
              {mounted && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>更新: {currentTime}</span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={fetchKpis}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                刷新
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          {kpiLoading ? <KpiSkeleton /> : kpiData && <KpiCards data={kpiData} />}

          {/* Charts and Activity Row */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
            {/* Trend Chart - takes 4 columns on md, 5 on lg */}
            <div className="md:col-span-4 lg:col-span-5">
              <TrendChart />
            </div>

            {/* Recent Activity - takes 3 columns */}
            <div className="md:col-span-3 lg:col-span-2">
              <RecentActivity />
            </div>
          </div>

          {/* Order Status Chart */}
          <div className="grid grid-cols-1 gap-6">
            <OrderStatusChart />
          </div>
        </div>
      </main>
    </div>
  );
}
