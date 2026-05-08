'use client';

import { useEffect, useState } from 'react';
import {
  Wrench,
  ClipboardCheck,
  PackageCheck,
  Play,
  Pause,
  RotateCcw,
  Circle,
  Flag,
  Box,
  AlertOctagon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { WorkOrder } from '../schemas';

export interface ProgressLog {
  id: string;
  work_order_id: string;
  operator_id: string;
  operator_name: string;
  action: string;
  completed_delta: number;
  remark: string | null;
  created_at: string;
}

const actionLabels: Record<string, { label: string; icon: React.ReactNode; color: string; dotColor: string }> = {
  start: { label: '开始生产', icon: <Play className="h-3.5 w-3.5" />, color: 'text-blue-600', dotColor: 'bg-blue-500' },
  report_progress: { label: '汇报进度', icon: <Wrench className="h-3.5 w-3.5" />, color: 'text-slate-600', dotColor: 'bg-slate-400' },
  complete_cutting: { label: '完成下料', icon: <Box className="h-3.5 w-3.5" />, color: 'text-indigo-600', dotColor: 'bg-indigo-500' },
  complete_assembly: { label: '完成组装', icon: <Wrench className="h-3.5 w-3.5" />, color: 'text-blue-600', dotColor: 'bg-blue-500' },
  complete_painting: { label: '完成涂装', icon: <Flag className="h-3.5 w-3.5" />, color: 'text-purple-600', dotColor: 'bg-purple-500' },
  quality_check: { label: '提交质检', icon: <ClipboardCheck className="h-3.5 w-3.5" />, color: 'text-amber-600', dotColor: 'bg-amber-500' },
  warehouse_in: { label: '确认入库', icon: <PackageCheck className="h-3.5 w-3.5" />, color: 'text-green-600', dotColor: 'bg-green-500' },
  report_defect: { label: '异常上报', icon: <AlertOctagon className="h-3.5 w-3.5" />, color: 'text-red-600', dotColor: 'bg-red-500' },
  pause: { label: '暂停生产', icon: <Pause className="h-3.5 w-3.5" />, color: 'text-slate-500', dotColor: 'bg-slate-400' },
  resume: { label: '恢复生产', icon: <RotateCcw className="h-3.5 w-3.5" />, color: 'text-blue-600', dotColor: 'bg-blue-500' },
  abort: { label: '中止工单', icon: <AlertOctagon className="h-3.5 w-3.5" />, color: 'text-red-600', dotColor: 'bg-red-500' },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  return `${month}月${day}日 ${hour}:${minute}`;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return formatDateTime(dateStr);
}

interface TimelineHistoryProps {
  workOrder: WorkOrder | null;
}

export function TimelineHistory({ workOrder }: TimelineHistoryProps) {
  const [logs, setLogs] = useState<ProgressLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workOrder) {
      setLogs([]);
      return;
    }

    setLoading(true);
    fetch(`/api/progress/logs?work_order_id=${workOrder.id}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setLogs(result.data);
        }
      })
      .catch((err) => {
        console.error('获取进度日志失败:', err);
      })
      .finally(() => setLoading(false));
  }, [workOrder]);

  if (!workOrder) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-2">
          <Circle className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">暂无流转记录</p>
        <p className="text-xs text-muted-foreground mt-1">工单创建后将在此显示操作历史</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="relative pl-7">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-3 bottom-3 w-px bg-gradient-to-b from-primary/40 via-border to-border" />

        <div className="space-y-5">
          {logs.map((log, idx) => {
            const actionConfig = actionLabels[log.action] || {
              label: log.action,
              icon: <Circle className="h-3.5 w-3.5" />,
              color: 'text-slate-500',
              dotColor: 'bg-slate-400',
            };
            const isLatest = idx === 0;
            const isDefect = log.action === 'report_defect' || log.action === 'abort';

            return (
              <div key={log.id} className="relative">
                {/* Dot with pulse for latest */}
                <div
                  className={cn(
                    'absolute -left-7 top-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center',
                    isLatest ? 'ring-4 ring-primary/10' : ''
                  )}
                >
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      isLatest ? actionConfig.dotColor : 'bg-muted-foreground/30'
                    )}
                  />
                  {isLatest && (
                    <div className={cn(
                      'absolute inset-0 rounded-full animate-ping opacity-20',
                      actionConfig.dotColor
                    )} />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('flex items-center gap-1.5 text-sm font-medium', actionConfig.color)}>
                      {actionConfig.icon}
                      {actionConfig.label}
                    </span>
                    {isLatest && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
                        最新
                      </Badge>
                    )}
                    {isDefect && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        异常
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDateTime(log.created_at)}</span>
                    <span className="text-border">·</span>
                    <span>{log.operator_name || '系统'}</span>
                    {log.completed_delta > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-200 bg-green-50">
                        +{log.completed_delta}件
                      </Badge>
                    )}
                  </div>

                  <div className="text-[11px] text-muted-foreground/70">{formatRelativeTime(log.created_at)}</div>

                  {log.remark && (
                    <p className={cn(
                      'text-xs rounded-md px-2.5 py-1.5 mt-1 border',
                      isDefect ? 'bg-red-50 text-red-700 border-red-200' : 'bg-muted/50 text-muted-foreground border-transparent'
                    )}>
                      {log.remark}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
