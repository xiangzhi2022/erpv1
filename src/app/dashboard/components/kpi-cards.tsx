'use client';

import { useRouter } from 'next/navigation';
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
  Package,
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
  poolOrders: number;
  thisMonthRevenue: number;
  revenueGrowth: number;
  pendingTasks: number;
  totalOrders: number;
  thisMonthOrders: number;
  lastMonthOrders: number;
}

interface KpiCardProps {
  data: KpiData;
}

function formatRevenue(v: number): string {
  if (v >= 100000000) return `¥${(v / 100000000).toFixed(2)}亿`;
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`;
  return `¥${v.toLocaleString()}`;
}

function formatNumber(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
  return v.toLocaleString();
}

interface KpiCardDef {
  key: keyof KpiData;
  title: string;
  growthKey: keyof KpiData | null;
  icon: typeof Users;
  color: string;
  bgColor: string;
  format: (v: number) => string;
  href?: string;
  description?: string;
}

const kpiCardDefs: KpiCardDef[] = [
  {
    key: 'dealerCount',
    title: '经销商总数',
    growthKey: 'dealerGrowth',
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    format: formatNumber,
    href: '/settings?tab=users',
    description: '已注册经销商',
  },
  {
    key: 'thisMonthNewCustomers',
    title: '本月新增客户',
    growthKey: 'customerGrowth',
    icon: UserPlus,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    format: formatNumber,
    description: '本月注册客户数',
  },
  {
    key: 'pendingOrders',
    title: '待处理订单',
    growthKey: null,
    icon: FileText,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10 dark:bg-orange-500/20',
    format: formatNumber,
    href: '/orders?status=pending',
    description: '待接收/已退回',
  },
  {
    key: 'producingOrders',
    title: '生产中',
    growthKey: null,
    icon: Clock,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 dark:bg-purple-500/20',
    format: formatNumber,
    href: '/orders?status=producing',
    description: '正在生产',
  },
  {
    key: 'thisMonthRevenue',
    title: '本月营收',
    growthKey: 'revenueGrowth',
    icon: DollarSign,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20',
    format: formatRevenue,
    description: '本月订单总额',
  },
  {
    key: 'completedOrders',
    title: '已完工',
    growthKey: null,
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 dark:bg-green-500/20',
    format: formatNumber,
    href: '/orders?status=completed',
    description: '含已发货',
  },
  {
    key: 'poolOrders',
    title: '订单池',
    growthKey: null,
    icon: Package,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    format: formatNumber,
    href: '/orders?status=pool',
    description: '未排产订单',
  },
  {
    key: 'pendingTasks',
    title: '待处理任务',
    growthKey: null,
    icon: ListTodo,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500/10 dark:bg-rose-500/20',
    format: formatNumber,
    href: '/tasks',
    description: '待执行/进行中',
  },
];

export function KpiCards({ data }: KpiCardProps) {
  const router = useRouter();

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {kpiCardDefs.map((card) => {
        const value = data[card.key] as number;
        const growth = card.growthKey ? (data[card.growthKey] as number) : null;
        const isPositiveGrowth = growth !== null && growth >= 0;
        const isClickable = !!card.href;

        return (
          <Card
            key={card.key}
            className={cn(
              'overflow-hidden transition-all',
              isClickable && 'cursor-pointer hover:shadow-md hover:border-primary/20'
            )}
            onClick={() => {
              if (card.href) router.push(card.href);
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground truncate">
                {card.title}
              </CardTitle>
              <div className={cn('p-1.5 rounded-md shrink-0', card.bgColor)}>
                <card.icon className={cn('h-3.5 w-3.5', card.color)} />
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-xl font-bold tracking-tight">
                {card.format(value)}
              </div>
              <div className="flex items-center gap-1 mt-1 min-h-[18px]">
                {growth !== null ? (
                  <>
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
                    <span className="text-[10px] text-muted-foreground">较上月</span>
                  </>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {card.description}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
