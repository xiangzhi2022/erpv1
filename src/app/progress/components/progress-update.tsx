'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wrench,
  ClipboardCheck,
  PackageCheck,
  Play,
  Pause,
  RotateCcw,
  ScanLine,
  Minus,
  Plus,
  Box,
  Flag,
  AlertOctagon,
  Info,
} from 'lucide-react';
import type { WorkOrder, WorkOrderStatusType } from '../schemas';

// Actions grouped by current status context
const actionGroups: Record<string, Array<{
  value: string;
  label: string;
  icon: React.ReactNode;
  targetStatus?: WorkOrderStatusType;
  needsQuantity: boolean;
  needsRemark: boolean;
}>> = {
  producing: [
    { value: 'report_progress', label: '汇报进度', icon: <Wrench className="h-3.5 w-3.5" />, needsQuantity: true, needsRemark: false },
    { value: 'complete_cutting', label: '完成下料', icon: <Box className="h-3.5 w-3.5" />, needsQuantity: true, needsRemark: false },
    { value: 'complete_assembly', label: '完成组装', icon: <Wrench className="h-3.5 w-3.5" />, needsQuantity: true, needsRemark: false },
    { value: 'complete_painting', label: '完成涂装', icon: <Flag className="h-3.5 w-3.5" />, needsQuantity: true, needsRemark: false },
    { value: 'quality_check', label: '提交质检', icon: <ClipboardCheck className="h-3.5 w-3.5" />, targetStatus: 'inspecting', needsQuantity: false, needsRemark: false },
    { value: 'report_defect', label: '异常上报', icon: <AlertOctagon className="h-3.5 w-3.5" />, needsQuantity: false, needsRemark: true },
    { value: 'pause', label: '暂停生产', icon: <Pause className="h-3.5 w-3.5" />, targetStatus: 'pending', needsQuantity: false, needsRemark: false },
  ],
  pending: [
    { value: 'start', label: '开始生产', icon: <Play className="h-3.5 w-3.5" />, targetStatus: 'producing', needsQuantity: false, needsRemark: false },
    { value: 'abort', label: '中止工单', icon: <AlertOctagon className="h-3.5 w-3.5" />, targetStatus: 'aborted', needsQuantity: false, needsRemark: true },
  ],
  inspecting: [
    { value: 'warehouse_in', label: '确认入库', icon: <PackageCheck className="h-3.5 w-3.5" />, targetStatus: 'stored', needsQuantity: false, needsRemark: false },
    { value: 'report_defect', label: '质检异常', icon: <AlertOctagon className="h-3.5 w-3.5" />, needsQuantity: false, needsRemark: true },
  ],
  stored: [],
  aborted: [
    { value: 'resume', label: '恢复生产', icon: <RotateCcw className="h-3.5 w-3.5" />, targetStatus: 'producing', needsQuantity: false, needsRemark: false },
  ],
};

const statusLabels: Record<string, string> = {
  pending: '待排产',
  producing: '生产中',
  inspecting: '质检中',
  stored: '已入库',
  aborted: '异常中止',
};

interface ProgressUpdateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
  onSubmit: (data: {
    work_order_id: string;
    action: string;
    completed_delta: number;
    remark: string;
  }) => Promise<void>;
}

export function ProgressUpdateSheet({
  open,
  onOpenChange,
  workOrder,
  onSubmit,
}: ProgressUpdateSheetProps) {
  const [action, setAction] = useState('');
  const [completedDelta, setCompletedDelta] = useState(0);
  const [remark, setRemark] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const remaining = workOrder
    ? workOrder.target_quantity - workOrder.completed_quantity
    : 0;
  const percentage = workOrder && workOrder.target_quantity > 0
    ? Math.round((workOrder.completed_quantity / workOrder.target_quantity) * 100)
    : 0;

  const availableActions = workOrder ? (actionGroups[workOrder.status] || []) : [];
  const selectedAction = availableActions.find((a) => a.value === action);
  const needsQuantity = selectedAction?.needsQuantity ?? false;
  const needsRemark = selectedAction?.needsRemark ?? false;

  // Auto-select first available action when work order changes
  const prevWorkOrderId = useRef<string | null>(null);
  if (workOrder && workOrder.id !== prevWorkOrderId.current) {
    prevWorkOrderId.current = workOrder.id;
    const actions = actionGroups[workOrder.status] || [];
    if (actions.length > 0) {
      setAction(actions[0].value);
    } else {
      setAction('');
    }
    setCompletedDelta(0);
    setRemark('');
    setBarcodeInput('');
  }

  const handleSubmit = useCallback(async () => {
    if (!workOrder || !action) return;

    // Validation
    if (needsQuantity && completedDelta <= 0) return;
    if (needsRemark && !remark.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        work_order_id: workOrder.id,
        action,
        completed_delta: needsQuantity ? completedDelta : 0,
        remark,
      });
      setCompletedDelta(0);
      setRemark('');
      onOpenChange(false);
    } catch {
      // Error is handled by parent
    } finally {
      setSubmitting(false);
    }
  }, [workOrder, action, completedDelta, remark, needsQuantity, needsRemark, onSubmit, onOpenChange]);

  const handleBarcodeScan = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && barcodeInput.trim()) {
        // Barcode scanned - for now just show feedback
        // In real integration, this would look up the work order
        setBarcodeInput('');
      }
    },
    [barcodeInput]
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setCompletedDelta(0);
        setRemark('');
        setBarcodeInput('');
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  if (!workOrder) return null;

  const isSubmitDisabled =
    submitting ||
    !action ||
    (needsQuantity && completedDelta <= 0) ||
    (needsRemark && !remark.trim());

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-lg">进度上报</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-auto space-y-5 py-4">
          {/* Work order summary */}
          <div className="rounded-lg border p-3.5 space-y-2.5 bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm truncate pr-2">{workOrder.product_name}</p>
              <Badge variant="outline" className="text-xs shrink-0 font-mono">
                {workOrder.order?.order_no || '--'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                已完成 {workOrder.completed_quantity} / {workOrder.target_quantity}
              </span>
              <span className={`font-semibold tabular-nums ${percentage >= 100 ? 'text-green-600' : ''}`}>
                {percentage}%
              </span>
            </div>
            <Progress
              value={Math.min(percentage, 100)}
              className="h-1.5"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>当前状态: <Badge variant="secondary" className="text-[10px] ml-0.5">{statusLabels[workOrder.status] || workOrder.status}</Badge></span>
              {remaining > 0 && <span>剩余 {remaining} 件</span>}
            </div>
          </div>

          {/* Barcode input (scan gun support) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <ScanLine className="h-3 w-3" />
              扫码输入（支持扫码枪）
            </Label>
            <Input
              ref={barcodeRef}
              placeholder="扫描或输入条码后按回车..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeScan}
              className="h-8 text-sm font-mono"
            />
          </div>

          <Separator />

          {/* Action select */}
          {availableActions.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-xs">操作类型</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableActions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-1.5">
                        {opt.icon}
                        {opt.label}
                        {opt.targetStatus && (
                          <span className="text-muted-foreground text-[10px]">
                            → {statusLabels[opt.targetStatus]}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Action hint */}
              {selectedAction?.targetStatus && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  <Info className="h-3 w-3 shrink-0" />
                  执行此操作后，工单状态将变为「{statusLabels[selectedAction.targetStatus]}」
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground bg-muted/30 rounded-lg">
              当前状态「{statusLabels[workOrder.status]}」无可执行操作
            </div>
          )}

          {/* Completed quantity input */}
          {needsQuantity && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                本次完成数量
                <span className="text-muted-foreground ml-1">
                  （剩余: {remaining}）
                </span>
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setCompletedDelta(Math.max(0, completedDelta - 1))}
                  disabled={completedDelta <= 0}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={remaining}
                  value={completedDelta}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setCompletedDelta(Math.min(Math.max(0, val), remaining));
                  }}
                  className="h-9 text-center flex-1 tabular-nums"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setCompletedDelta(Math.min(remaining, completedDelta + 1))}
                  disabled={completedDelta >= remaining}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 text-xs shrink-0"
                  onClick={() => setCompletedDelta(remaining)}
                  disabled={remaining <= 0}
                >
                  全部
                </Button>
              </div>
            </div>
          )}

          {/* Remark textarea */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              备注 / 异常说明
              {needsRemark && <span className="text-red-500 ml-0.5">*</span>}
            </Label>
            <Textarea
              placeholder={
                needsRemark
                  ? '请描述异常情况（如设备故障、缺料、质量缺陷等）...'
                  : '可选：补充说明...'
              }
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <SheetFooter className="pt-4 border-t">
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
            >
              {submitting ? '提交中...' : '确认上报'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
