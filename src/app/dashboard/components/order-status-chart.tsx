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

interface StatusDataItem {
  name: string;
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
      const res = await fetch('/api/orders');
      if (res.ok) {
        const result = await res.json();
        const orders = result.data || [];

        // 按状态聚合
        const statusCount: Record<string, number> = {};
        for (const order of orders) {
          const status = order.status || 'pending';
          statusCount[status] = (statusCount[status] || 0) + 1;
        }

        const chartData = Object.entries(statusCount)
          .filter(([, count]) => count > 0)
          .map(([status, count]) => ({
            name: status,
            value: count,
            fill: statusColorMap[status] || 'hsl(var(--muted))',
          }));

        setData(chartData);
        setTotal(orders.length);
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
          <CardTitle>订单状态分布</CardTitle>
          <CardDescription>当前所有订单状态占比</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            加载中...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>订单状态分布</CardTitle>
          <CardDescription>当前所有订单状态占比</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            暂无数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>订单状态分布</CardTitle>
        <CardDescription>当前所有订单状态占比</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={statusChartConfig} className="h-[280px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
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
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {total}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-sm"
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
              className="-mt-4 flex-wrap gap-2"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
