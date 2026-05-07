'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MapPin, FileText, Star, Tag } from 'lucide-react';
import type { Supplier } from '../schemas';

interface SupplierDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onEdit: (supplier: Supplier) => void;
}

const ratingConfig: Record<string, { label: string; className: string }> = {
  A: { label: 'A级', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  B: { label: 'B级', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  C: { label: 'C级', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  D: { label: 'D级', className: 'bg-red-100 text-red-700 border-red-200' },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: '活跃', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inspecting: { label: '考察中', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  blacklisted: { label: '已拉黑', className: 'bg-gray-200 text-gray-500 border-gray-300 line-through' },
};

export function SupplierDetailDialog({ open, onOpenChange, supplier, onEdit }: SupplierDetailDialogProps) {
  if (!supplier) return null;

  const rating = ratingConfig[supplier.rating] || ratingConfig['B'];
  const status = statusConfig[supplier.status] || statusConfig['active'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {supplier.name}
            <Badge variant="outline" className={rating.className}>{rating.label}</Badge>
            <Badge variant="outline" className={status.className}>{status.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 基础信息 */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              基础信息
            </h4>
            <Separator className="mb-3" />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">编号</span>
                <p className="font-mono text-xs mt-0.5">{supplier.supplier_code}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{supplier.category || '-'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>评级: {supplier.rating}级</span>
              </div>
              <div>
                <span className="text-muted-foreground">创建时间</span>
                <p className="text-xs mt-0.5">{new Date(supplier.created_at).toLocaleString('zh-CN')}</p>
              </div>
            </div>
          </div>

          {/* 联系方式 */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">联系方式</h4>
            <Separator className="mb-3" />
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {supplier.phone ? (
                  <a href={`tel:${supplier.phone}`} className="hover:text-primary transition-colors">
                    {supplier.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">未填写</span>
                )}
                <span className="text-muted-foreground ml-2">({supplier.contact_person || '未填写'})</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {supplier.email ? (
                  <a href={`mailto:${supplier.email}`} className="hover:text-primary transition-colors">
                    {supplier.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">未填写</span>
                )}
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span>{supplier.address || '未填写'}</span>
              </div>
            </div>
          </div>

          {/* 备注 */}
          {supplier.remark && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">备注</h4>
              <Separator className="mb-3" />
              <p className="text-sm text-muted-foreground">{supplier.remark}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          <Button onClick={() => {
            onOpenChange(false);
            onEdit(supplier);
          }}>
            编辑
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
