'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartDataItem {
  month: string;
  orders: number;
  revenue: number;
  newDealers: number;
  newCustomers: number;
}

const orderChartConfig = {
  orders: { label: '订单数', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const revenueChartConfig = {
  revenue: { label: '营收额', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

const dealerChartConfig = {
  newDealers: { label: '新增经销商', color: 'hsl(var(--chart-3))' },
  newCustomers: { label: '新增客户', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig;

function formatYAxis(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(0)}万`;
  return value.toString();
}

export function TrendChart() {
  const [data, setData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChartData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/dashboard/chart');
      if (res.ok) {
        const result = await res.json();
        setData(result.data || []);
      }
    } catch (err) {
      console.error('Fetch chart data error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>趋势分析</CardTitle>
              <CardDescription>过去 6 个月数据趋势</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some((d) => d.orders > 0 || d.revenue > 0 || d.newDealers > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>趋势分析</CardTitle>
              <CardDescription>过去 6 个月数据趋势</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fetchChartData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-3">
            <TrendingUp className="h-10 w-10 opacity-30" />
            <div className="text-center">
              <p className="text-sm font-medium">暂无趋势数据</p>
              <p className="text-xs mt-1">当产生订单和客户数据后，趋势图将自动展示</p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="mb-4 h-8">
              <TabsTrigger value="orders" className="text-xs gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                订单趋势
              </TabsTrigger>
              <TabsTrigger value="revenue" className="text-xs gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                营收趋势
              </TabsTrigger>
              <TabsTrigger value="dealers" className="text-xs gap-1">
                <Users className="h-3.5 w-3.5" />
                增长趋势
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-0">
              <ChartContainer config={orderChartConfig} className="h-[260px] w-full">
                <BarChart data={data} accessibilityLayer>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </TabsContent>

            <TabsContent value="revenue" className="mt-0">
              <ChartContainer config={revenueChartConfig} className="h-[260px] w-full">
                <LineChart data={data} accessibilityLayer>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} tickFormatter={formatYAxis} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: 'var(--color-revenue)' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ChartContainer>
            </TabsContent>

            <TabsContent value="dealers" className="mt-0">
              <ChartContainer config={dealerChartConfig} className="h-[260px] w-full">
                <BarChart data={data} accessibilityLayer>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="newDealers" fill="var(--color-newDealers)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="newCustomers" fill="var(--color-newCustomers)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

