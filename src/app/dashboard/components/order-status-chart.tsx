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
import { Cell, Pie, PieChart, Label } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

interface StatusDataItem {
  name: string;
  label?: string;
  value: number;
  fill: string;
}

const statusChartConfig = {
  pending: { label: '待接收', color: 'hsl(var(--chart-1))' },
  returned: { label: '已退回', color: 'hsl(0 72% 51%)' },
  confirmed: { label: '已接收', color: 'hsl(var(--chart-2))' },
  producing: { label: '生产中', color: 'hsl(var(--chart-3))' },
  pool: { label: '订单池', color: 'hsl(var(--chart-4))' },
  shipped: { label: '已发货', color: 'hsl(var(--chart-5))' },
  completed: { label: '已完成', color: 'hsl(142 71% 45%)' },
  cancelled: { label: '已取消', color: 'hsl(215 14% 34%)' },
} satisfies ChartConfig;

const statusColorMap: Record<string, string> = {
  pending: 'hsl(var(--chart-1))',
  returned: 'hsl(0 72% 51%)',
  confirmed: 'hsl(var(--chart-2))',
  producing: 'hsl(var(--chart-3))',
  pool: 'hsl(var(--chart-4))',
  shipped: 'hsl(var(--chart-5))',
  completed: 'hsl(142 71% 45%)',
  cancelled: 'hsl(215 14% 34%)',
};

export function OrderStatusChart() {
  const [data, setData] = useState<StatusDataItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/chart');
      if (res.ok) {
        const result = await res.json();
        const statusDistribution = Array.isArray(result.statusDistribution)
          ? result.statusDistribution
          : [];
        const chartData = statusDistribution
          .filter((item: StatusDataItem) => Number(item.value) > 0)
          .map((item: StatusDataItem) => ({
            name: item.name,
            label: item.label,
            value: Number(item.value) || 0,
            fill: item.fill || statusColorMap[item.name] || 'hsl(var(--muted))',
          }));

        setData(chartData);
        setTotal(chartData.reduce((sum: number, item: StatusDataItem) => sum + item.value, 0));
      }
    } catch (err) {
      console.error('Fetch order status error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>订单状态分布</CardTitle>
              <CardDescription>当前所有订单状态占比</CardDescription>
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

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>订单状态分布</CardTitle>
              <CardDescription>当前所有订单状态占比</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground gap-3">
            <PieChartIcon className="h-10 w-10 opacity-30" />
            <div className="text-center">
              <p className="text-sm font-medium">暂无订单数据</p>
              <p className="text-xs mt-1">创建订单后将自动展示状态分布</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>订单状态分布</CardTitle>
            <CardDescription>当前所有订单状态占比</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={statusChartConfig} className="h-[300px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
              stroke="hsl(var(--background))"
              paddingAngle={2}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 6}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {total}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 16}
                          className="fill-muted-foreground text-xs"
                        >
                          总订单
                        </tspan>
                      </text>
                    );
                  }
                  return null;
                }}
              />
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-mt-2 flex-wrap gap-x-4 gap-y-1"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
