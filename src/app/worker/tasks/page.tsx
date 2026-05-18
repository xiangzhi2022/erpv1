'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TaskRow {
  id: string;
  task_no?: string;
  task_name?: string;
  product_name?: string;
  process_name?: string;
  quantity?: number | string;
  unit?: string;
  length?: number | string;
  width?: number | string;
  thickness?: number | string;
  material?: string;
  color?: string;
  status?: string;
  estimated_wage_amount?: number | string;
  wage_record?: { wage_amount?: number | string; status?: string } | null;
  order?: { order_no?: string; customer_name?: string } | null;
  space?: { space_name?: string } | null;
  product?: { product_name?: string } | null;
}

function wage(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '-';
}

export default function WorkerTasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/worker/me/tasks');
    const json = await res.json();
    if (json.success) setTasks(json.data || []);
    else toast.error(json.error || '获取任务失败');
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const action = async (taskId: string, type: 'start' | 'submit') => {
    setLoadingId(taskId);
    const res = await fetch(`/api/production/tasks/${taskId}/${type}`, { method: 'PATCH' });
    const json = await res.json();
    setLoadingId(null);
    if (!json.success) return toast.error(json.error || '操作失败');
    if (json.wage_record) toast.success(`已提交，待审核工资 ${wage(json.wage_record.wage_amount)}`);
    else if (json.warning) toast.warning(json.warning);
    else toast.success(type === 'start' ? '已开始生产' : '已提交完成');
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">我的任务</h1>
          <p className="text-sm text-muted-foreground">只显示分配给当前工人的生产任务。</p>
        </div>
        <Button asChild variant="outline"><Link href="/worker/wages">我的工资</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{task.task_name || task.product_name}</CardTitle>
                <Badge variant="secondary">{task.status}</Badge>
              </div>
              <div className="font-mono text-xs text-muted-foreground">{task.task_no || '-'}</div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>订单：{task.order?.order_no || '-'}</div>
              <div>空间 / 产品：{task.space?.space_name || '-'} / {task.product?.product_name || task.product_name || '-'}</div>
              <div>工序：{task.process_name || '-'}</div>
              <div>数量：{task.quantity || 0} {task.unit || ''}</div>
              <div>尺寸：{task.length || '-'} × {task.width || '-'} × {task.thickness || '-'}</div>
              <div>材质 / 颜色：{task.material || '-'} / {task.color || '-'}</div>
              {task.wage_record ? <div>本任务工资：{wage(task.wage_record.wage_amount)}（{task.wage_record.status || '待审核'}）</div> : null}
              {!task.wage_record && task.estimated_wage_amount !== undefined ? <div>本任务工资：{wage(task.estimated_wage_amount)}</div> : null}
              <div className="flex gap-2 pt-2">
                {task.status === 'assigned' || task.status === 'pending_start' ? (
                  <Button disabled={loadingId === task.id} onClick={() => action(task.id, 'start')}>开始生产</Button>
                ) : null}
                {task.status === 'producing' || task.status === 'reworking' ? (
                  <Button disabled={loadingId === task.id} onClick={() => action(task.id, 'submit')}>提交完成</Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {tasks.length === 0 ? <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">暂无分配任务</div> : null}
    </div>
  );
}
