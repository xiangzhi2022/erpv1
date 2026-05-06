'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import { supplierStatuses, type Supplier } from '../schemas';

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onConfirm: (supplierId: string, newStatus: string) => Promise<void>;
  loading?: boolean;
}

export function StatusChangeDialog({ open, onOpenChange, supplier, onConfirm, loading }: StatusChangeDialogProps) {
  const [newStatus, setNewStatus] = useState<string>('');

  const isBlacklisting = newStatus === 'blacklisted';

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setNewStatus('');
    }
    onOpenChange(value);
  };

  const handleConfirm = async () => {
    if (!supplier || !newStatus) return;
    await onConfirm(supplier.id, newStatus);
    setNewStatus('');
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBlacklisting ? '确认拉黑供应商' : '变更合作状态'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                当前供应商：<strong>{supplier?.name}</strong>
              </p>
              <div>
                <span className="text-sm">请选择新的合作状态：</span>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierStatuses.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isBlacklisting && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 mt-2">
                  <p className="text-sm text-destructive font-medium">
                    确认拉黑该供应商吗？拉黑后将无法在采购单中选择该供应商。
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!newStatus || loading}
            className={isBlacklisting ? 'bg-destructive text-white hover:bg-destructive/90' : ''}
          >
            {loading ? '处理中...' : isBlacklisting ? '确认拉黑' : '确认变更'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
