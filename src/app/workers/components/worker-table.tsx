'use client';

import { Worker, getCraftLabel, getStatusInfo } from '../schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Eye, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface WorkerTableProps {
  workers: Worker[];
  loading: boolean;
  onEdit: (worker: Worker) => void;
  onDetail: (worker: Worker) => void;
  onDelete: (worker: Worker) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total: number;
}

export function WorkerTable({
  workers,
  loading,
  onEdit,
  onDetail,
  onDelete,
  page,
  totalPages,
  onPageChange,
  total,
}: WorkerTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center text-muted-foreground">
        暂无工人数据
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">工号</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">姓名</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">性别</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">工种</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">车间</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">状态</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">技能标签</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">入职日期</th>
              <th className="text-right p-3 text-sm font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => {
              const statusInfo = getStatusInfo(worker.status);
              return (
                <tr key={worker.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-sm font-mono">{worker.worker_no || '-'}</td>
                  <td className="p-3 text-sm font-medium">{worker.name}</td>
                  <td className="p-3 text-sm">
                    {worker.gender === 'male' ? '男' : worker.gender === 'female' ? '女' : '-'}
                  </td>
                  <td className="p-3 text-sm">{getCraftLabel(worker.craft_type)}</td>
                  <td className="p-3 text-sm">{worker.workshop_name || '-'}</td>
                  <td className="p-3 text-sm">
                    <Badge variant="secondary" className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  </td>
                  <td className="p-3 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {worker.skill_tags ? JSON.parse(worker.skill_tags).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      )) : null}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {worker.hire_date ? new Date(worker.hire_date).toLocaleDateString('zh-CN') : '-'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onDetail(worker)} title="查看详情">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(worker)} title="编辑">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(worker)} title="删除" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between p-3 border-t">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{page} / {totalPages || 1}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
