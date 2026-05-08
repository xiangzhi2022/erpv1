'use client';

import { Worker, getCraftLabel, getStatusInfo, GENDERS } from '../schemas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Briefcase, Building2, Calendar, Tag, FileText } from 'lucide-react';

interface WorkerDetailDialogProps {
  worker: Worker | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkerDetailDialog({ worker, open, onOpenChange }: WorkerDetailDialogProps) {
  if (!worker) return null;

  const statusInfo = getStatusInfo(worker.status);
  const genderLabel = GENDERS.find(g => g.value === worker.gender)?.label || '-';

  const infoItems = [
    { icon: User, label: '工号', value: worker.worker_no || '-' },
    { icon: Phone, label: '手机号', value: worker.phone || '-' },
    { icon: User, label: '性别', value: genderLabel },
    { icon: Briefcase, label: '工种', value: getCraftLabel(worker.craft_type) },
    { icon: Building2, label: '所属车间', value: worker.workshop_name || '-' },
    { icon: Calendar, label: '入职日期', value: worker.hire_date ? new Date(worker.hire_date).toLocaleDateString('zh-CN') : '-' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{worker.name}</span>
            <Badge variant="secondary" className={statusInfo.color}>
              {statusInfo.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {infoItems.map((item) => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <item.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground w-20">{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}

          {worker.skill_tags && (
            <div className="flex items-start gap-3 text-sm">
              <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground w-20">技能标签</span>
              <div className="flex flex-wrap gap-1">
                {JSON.parse(worker.skill_tags).map((tag: string) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {worker.remark && (
            <div className="flex items-start gap-3 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground w-20">备注</span>
              <span className="text-sm">{worker.remark}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
