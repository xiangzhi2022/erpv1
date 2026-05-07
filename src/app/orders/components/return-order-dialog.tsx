'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface ReturnOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNo: string;
  onSubmit: (reason: string) => void;
  loading: boolean;
}

export function ReturnOrderDialog({ open, onOpenChange, orderNo, onSubmit, loading }: ReturnOrderDialogProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (reason.trim()) {
      onSubmit(reason.trim());
      setReason('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>退回订单</DialogTitle>
          <DialogDescription>
            退回订单 {orderNo}，请填写退回原因
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>退回原因 *</Label>
            <Textarea
              placeholder="请输入退回原因"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            确认退回
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
