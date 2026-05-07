'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  UserPlus,
  FileText,
  Clock,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KpiData {
  dealerCount: number;
  dealerGrowth: number;
  thisMonthNewCustomers: number;
  customerGrowth: number;
  pendingOrders: number;
  producingOrders: number;
  completedOrders: number;
  thisMonthRevenue: number;
  revenueGrowth: number;
  pendingTasks: number;
}

interface KpiCardProps {
  data: KpiData;
}

const kpiCards = [
  {
    key: 'dealerCount' as const,
    title: '经销商数',
    growthKey: 'dealerGrowth' as const,
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    format: (v: number) => v.toString(),
  },
  {
    key: 'thisMonthNewCustomers' as const,
    title: '本月新增客户',
    growthKey: 'customerGrowth' as const,
    icon: UserPlus,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    format: (v: number) => v.toString(),
  },
  {
    key: 'pendingOrders' as const,
    title: '待处理订单',
    growthKey: null,
    icon: FileText,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    format: (v: number) => v.toString(),
  },
  {
    key: 'producingOrders' as const,
    title: '生产中订单',
    growthKey: null,
    icon: Clock,
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    format: (v: number) => v.toString(),
  },
  {
    key: 'completedOrders' as const,
    title: '已完工订单',
    growthKey: null,
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    format: (v: number) => v.toString(),
  },
  {
    key: 'thisMonthRevenue' as const,
    title: '本月营收预测',
    growthKey: 'revenueGrowth' as const,
    icon: DollarSign,
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10',
    format: (v: number) => `¥${(v / 10000).toFixed(1)}万`,
  },
  {
    key: 'pendingTasks' as const,
    title: '待处理任务',
    growthKey: null,
    icon: ListTodo,
    color: 'text-rose-600',
    bgColor: 'bg-rose-500/10',
    format: (v: number) => v.toString(),
  },
];

export function KpiCards({ data }: KpiCardProps) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {kpiCards.map((card) => {
        const value = data[card.key];
        const growth = card.growthKey ? data[card.growthKey] : null;
        const isPositiveGrowth = growth !== null && growth >= 0;

        return (
          <Card key={card.key} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={cn('p-2 rounded-lg', card.bgColor)}>
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">
                {card.format(value)}
              </div>
              {growth !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {isPositiveGrowth ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isPositiveGrowth ? 'text-emerald-500' : 'text-red-500'
                    )}
                  >
                    {isPositiveGrowth ? '+' : ''}
                    {growth}%
                  </span>
                  <span className="text-xs text-muted-foreground">较上月</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
