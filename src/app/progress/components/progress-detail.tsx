'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { TimelineHistory } from './timeline-history';
import {
  Clock,
  MapPin,
  Package,
  CalendarDays,
  Wrench,
  ClipboardCheck,
  PackageCheck,
  XCircle,
  Factory,
  ArrowRight,
} from 'lucide-react';
import type { WorkOrder, WorkOrderStatusType } from '../schemas';

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: { label: '待排产', color: 'text-slate-600', bgColor: 'bg-slate-50', icon: <Clock className="h-3.5 w-3.5" /> },
  producing: { label: '生产中', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: <Wrench className="h-3.5 w-3.5" /> },
  inspecting: { label: '质检中', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  stored: { label: '已入库', color: 'text-green-600', bgColor: 'bg-green-50', icon: <PackageCheck className="h-3.5 w-3.5" /> },
  aborted: { label: '异常中止', color: 'text-red-600', bgColor: 'bg-red-50', icon: <XCircle className="h-3.5 w-3.5" /> },
};

const statusFlow: WorkOrderStatusType[] = ['pending', 'producing', 'inspecting', 'stored'];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

interface ProgressDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
  onUpdate?: (workOrder: WorkOrder) => void;
}

export function ProgressDetailSheet({
  open,
  onOpenChange,
  workOrder,
  onUpdate,
}: ProgressDetailSheetProps) {
  if (!workOrder) return null;

  const percentage =
    workOrder.target_quantity > 0
      ? Math.round((workOrder.completed_quantity / workOrder.target_quantity) * 100)
      : 0;

  const isOverdue =
    workOrder.expected_end_date &&
    workOrder.status !== 'stored' &&
    workOrder.status !== 'aborted' &&
    new Date(workOrder.expected_end_date) < new Date();

  const currentStatusIdx = statusFlow.indexOf(workOrder.status as WorkOrderStatusType);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:max-w-[500px] flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">工单详情</SheetTitle>
            {onUpdate && workOrder.status !== 'stored' && workOrder.status !== 'aborted' && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  onUpdate(workOrder);
                  onOpenChange(false);
                }}
              >
                <Wrench className="h-3.5 w-3.5 mr-1" />
                上报进度
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-auto space-y-5 py-4">
          {/* Basic info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base">{workOrder.product_name}</h3>
              {(() => {
                const sc = statusConfig[workOrder.status];
                return sc ? (
                  <Badge variant="outline" className={`${sc.bgColor} ${sc.color} border-current/20 text-xs gap-1`}>
                    {sc.icon}
                    {sc.label}
                  </Badge>
                ) : null;
              })()}
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">延期</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">工单号: <span className="text-foreground font-mono">{workOrder.order?.order_no || '--'}</span></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Factory className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{workOrder.workshop?.name || '未分配车间'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">交期: <span className={isOverdue ? 'text-red-600 font-medium' : 'text-foreground'}>{formatDate(workOrder.expected_end_date)}</span></span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">客户: <span className="text-foreground">{workOrder.order?.customer_name || '--'}</span></span>
              </div>
              {workOrder.start_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">开工: <span className="text-foreground">{formatDate(workOrder.start_date)}</span></span>
                </div>
              )}
              {workOrder.actual_end_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <PackageCheck className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">完工: <span className="text-foreground">{formatDate(workOrder.actual_end_date)}</span></span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Status flow visualization */}
          <div className="space-y-2">
            <span className="text-sm font-medium">流转状态</span>
            <div className="flex items-center gap-1">
              {statusFlow.map((status, idx) => {
                const sc = statusConfig[status];
                const isCompleted = idx < currentStatusIdx;
                const isCurrent = idx === currentStatusIdx;
                // isPending: idx > currentStatusIdx

                return (
                  <div key={status} className="flex items-center gap-1 flex-1">
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium w-full justify-center ${
                        isCompleted
                          ? 'bg-green-100 text-green-700'
                          : isCurrent
                          ? `${sc.bgColor} ${sc.color} ring-2 ring-current/20`
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? <PackageCheck className="h-3 w-3" /> : sc.icon}
                      <span className="hidden sm:inline">{sc.label}</span>
                    </div>
                    {idx < statusFlow.length - 1 && (
                      <ArrowRight className={`h-3 w-3 shrink-0 ${isCompleted ? 'text-green-400' : 'text-border'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">生产进度</span>
              <span className="tabular-nums">
                <span className={percentage >= 100 ? 'text-green-600 font-semibold' : ''}>{workOrder.completed_quantity}</span>
                {' / '}
                {workOrder.target_quantity}
                {' '}
                <span className={`text-xs ${percentage >= 100 ? 'text-green-600' : 'text-muted-foreground'}`}>({percentage}%)</span>
              </span>
            </div>
            <Progress
              value={Math.min(percentage, 100)}
              className={`h-2.5 ${isOverdue ? '[&>div]:bg-red-500' : percentage >= 100 ? '[&>div]:bg-green-500' : ''}`}
            />
          </div>

          {workOrder.remark && (
            <>
              <Separator />
              <div className="text-sm">
                <span className="font-medium">备注: </span>
                <span className="text-muted-foreground">{workOrder.remark}</span>
              </div>
            </>
          )}

          <Separator />

          {/* Timeline */}
          <div>
            <h4 className="text-sm font-medium mb-3">流转记录</h4>
            <TimelineHistory workOrder={workOrder} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
