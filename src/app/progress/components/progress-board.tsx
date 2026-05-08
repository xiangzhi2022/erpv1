'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Wrench,
  ClipboardCheck,
  PackageCheck,
  BarChart3,
  ArrowUpDown,
  CalendarDays,
  Factory,
} from 'lucide-react';
import type { WorkOrder } from '../schemas';

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string; icon: React.ReactNode }
> = {
  pending: {
    label: '待排产',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  producing: {
    label: '生产中',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: <Wrench className="h-3.5 w-3.5" />,
  },
  inspecting: {
    label: '质检中',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
  },
  stored: {
    label: '已入库',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: <PackageCheck className="h-3.5 w-3.5" />,
  },
  aborted: {
    label: '异常中止',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

const priorityConfig: Record<string, { label: string; className: string; dotColor: string }> = {
  urgent: { label: '紧急', className: 'bg-red-500 text-white', dotColor: 'bg-red-500' },
  high: { label: '高', className: 'bg-orange-500 text-white', dotColor: 'bg-orange-500' },
  normal: { label: '普通', className: 'bg-slate-400 text-white', dotColor: 'bg-slate-400' },
  low: { label: '低', className: 'bg-slate-200 text-slate-600', dotColor: 'bg-slate-300' },
};

function getProgressColor(percentage: number, isOverdue: boolean) {
  if (isOverdue) return '[&>div]:bg-red-500';
  if (percentage >= 100) return '[&>div]:bg-green-500';
  if (percentage >= 80) return '[&>div]:bg-emerald-500';
  if (percentage >= 50) return '[&>div]:bg-blue-500';
  if (percentage >= 20) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-slate-400';
}

function isOverdue(wo: WorkOrder): boolean {
  if (!wo.expected_end_date || wo.status === 'stored' || wo.status === 'aborted') return false;
  return new Date(wo.expected_end_date) < new Date();
}

function getDaysRemaining(expectedEndDate: string | null): number | null {
  if (!expectedEndDate) return null;
  const diff = new Date(expectedEndDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

type SortKey = 'priority' | 'progress' | 'deadline' | 'created';
type SortOrder = 'asc' | 'desc';

const priorityWeight: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };

function sortWorkOrders(data: WorkOrder[], sortKey: SortKey, sortOrder: SortOrder): WorkOrder[] {
  const sorted = [...data].sort((a, b) => {
    const mul = sortOrder === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'priority':
        return ((priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)) * mul;
      case 'progress': {
        const pA = a.target_quantity > 0 ? a.completed_quantity / a.target_quantity : 0;
        const pB = b.target_quantity > 0 ? b.completed_quantity / b.target_quantity : 0;
        return (pB - pA) * mul;
      }
      case 'deadline': {
        const dA = a.expected_end_date ? new Date(a.expected_end_date).getTime() : Infinity;
        const dB = b.expected_end_date ? new Date(b.expected_end_date).getTime() : Infinity;
        return (dA - dB) * mul;
      }
      case 'created':
        return (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) * mul;
      default:
        return 0;
    }
  });
  return sorted;
}

interface ProgressBoardProps {
  data: WorkOrder[];
  onUpdate: (workOrder: WorkOrder) => void;
  onViewDetail: (workOrder: WorkOrder) => void;
}

export function ProgressBoard({ data, onUpdate, onViewDetail }: ProgressBoardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortKey(key);
      setSortOrder('desc');
      return key;
    });
  }, []);

  const sortedData = useMemo(
    () => sortWorkOrders(data, sortKey, sortOrder),
    [data, sortKey, sortOrder]
  );

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
        <BarChart3 className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-base font-medium">暂无工单数据</p>
        <p className="text-sm mt-1">试试调整筛选条件或创建新工单</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sort controls */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowUpDown className="h-3 w-3" />
        <span>排序:</span>
        {([
          ['created', '创建时间'],
          ['priority', '优先级'],
          ['progress', '完成度'],
          ['deadline', '交期'],
        ] as const).map(([key, label]) => (
          <Button
            key={key}
            variant={sortKey === key ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => toggleSort(key)}
          >
            {label}
            {sortKey === key && (
              <span className="ml-0.5">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </Button>
        ))}
        <span className="ml-auto text-muted-foreground">共 {data.length} 条工单</span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 overflow-auto p-0.5">
        {sortedData.map((wo) => {
          const percentage =
            wo.target_quantity > 0
              ? Math.round((wo.completed_quantity / wo.target_quantity) * 100)
              : 0;
          const overdue = isOverdue(wo);
          const daysRem = getDaysRemaining(wo.expected_end_date);
          const config = statusConfig[wo.status] || statusConfig.pending;
          const prioConfig = priorityConfig[wo.priority] || priorityConfig.normal;

          return (
            <Card
              key={wo.id}
              className={`group relative transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                overdue ? 'border-red-300 shadow-red-100' : ''
              }`}
            >
              {/* Overdue warning stripe */}
              {overdue && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-400 rounded-t-lg" />
              )}

              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={`${config.bgColor} ${config.color} border ${config.borderColor} shrink-0 text-xs gap-1`}
                    >
                      {config.icon}
                      {config.label}
                    </Badge>
                    {wo.priority !== 'normal' && (
                      <Badge className={`${prioConfig.className} text-[10px] px-1.5 py-0 shrink-0`}>
                        {prioConfig.label}
                      </Badge>
                    )}
                    {overdue && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0 animate-pulse">
                        延期
                      </Badge>
                    )}
                  </div>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onViewDetail(wo)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent side="left" className="w-60">
                      <div className="text-xs space-y-1.5">
                        <p className="font-medium text-sm">工单详情</p>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
                          <span>工单号</span>
                          <span className="text-foreground font-mono">{wo.order?.order_no || '--'}</span>
                          <span>客户</span>
                          <span className="text-foreground">{wo.order?.customer_name || '--'}</span>
                          <span>交期</span>
                          <span className="text-foreground">{formatDate(wo.order?.delivery_date || wo.expected_end_date)}</span>
                          <span>车间</span>
                          <span className="text-foreground">{wo.workshop?.name || '未分配'}</span>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-3">
                {/* Product name */}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate" title={wo.product_name}>
                    {wo.product_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {wo.order?.order_no && (
                      <span className="font-mono">{wo.order.order_no}</span>
                    )}
                    {wo.workshop?.name && (
                      <span className="flex items-center gap-0.5">
                        <Factory className="h-3 w-3" />
                        {wo.workshop.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {wo.completed_quantity} / {wo.target_quantity}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        overdue ? 'text-red-600' : percentage >= 100 ? 'text-green-600' : percentage >= 80 ? 'text-emerald-600' : ''
                      }`}
                    >
                      {percentage}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(percentage, 100)}
                    className={`h-2 ${getProgressColor(percentage, overdue)}`}
                  />
                </div>

                {/* Bottom info row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                  <div className="flex items-center gap-1">
                    {overdue ? (
                      <>
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                        <span className="text-red-600 font-medium">
                          {daysRem !== null && daysRem < 0 ? `逾期${Math.abs(daysRem)}天` : '已延期'}
                        </span>
                      </>
                    ) : wo.status === 'stored' ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span className="text-green-600">已入库</span>
                      </>
                    ) : wo.status === 'aborted' ? (
                      <>
                        <XCircle className="h-3 w-3 text-red-500" />
                        <span className="text-red-600">已中止</span>
                      </>
                    ) : (
                      <>
                        <CalendarDays className="h-3 w-3" />
                        <span>
                          {daysRem !== null
                            ? daysRem <= 3
                              ? `${daysRem}天后交期`
                              : formatDate(wo.expected_end_date)
                            : '未设交期'}
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => onUpdate(wo)}
                  >
                    上报
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
