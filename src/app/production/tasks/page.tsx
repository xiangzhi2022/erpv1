'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface TaskRow {
  id: string;
  task_no?: string;
  task_name?: string;
  task_type?: string;
  process_name?: string;
  status?: string;
  quantity?: number | string;
  unit?: string;
  length?: number | string;
  width?: number | string;
  thickness?: number | string;
  material?: string;
  color?: string;
  workstation_id?: string | null;
  estimated_wage_amount?: number | string;
  submitted_at?: string | null;
  order?: { order_no?: string; customer_name?: string } | null;
  space?: { space_name?: string } | null;
  product?: { product_name?: string } | null;
  worker?: { name?: string; worker_no?: string } | null;
}

interface WorkerRow {
  id: string;
  name?: string;
  worker_no?: string;
  craft_type?: string;
  score?: number;
  match_reasons?: string[];
}

const TASK_STATUSES = [
  'all',
  'pending_generate',
  'pending_assign',
  'assigned',
  'pending_start',
  'producing',
  'submitted',
  'pending_quality_check',
  'quality_passed',
  'quality_failed',
  'reworking',
  'completed',
  'abnormal',
];

const TASK_TYPES = ['all', 'board', 'door', 'hardware', 'process', 'install', 'package', 'delivery'];
const TASK_TYPE_LABELS: Record<string, string> = {
  all: '全部类型',
  board: '板件',
  door: '门板/房门',
  hardware: '五金',
  process: '工序',
  install: '安装',
  package: '包装',
  delivery: '发货',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  all: '全部状态',
  pending_generate: '待生成',
  pending_assign: '待分配',
  assigned: '已分配',
  pending_start: '待开始',
  producing: '生产中',
  submitted: '已提交',
  pending_quality_check: '待质检',
  quality_passed: '质检通过',
  quality_failed: '质检不通过',
  reworking: '返工中',
  completed: '已完成',
  abnormal: '异常',
};

function wage(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '-';
}

function statusClass(status: string | undefined): string {
  if (!status) return 'border-gray-200 bg-gray-50 text-gray-600';
  if (['completed', 'quality_passed'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['producing'].includes(status)) return 'border-orange-200 bg-orange-50 text-orange-700';
  if (['submitted'].includes(status)) return 'border-violet-200 bg-violet-50 text-violet-700';
  if (['pending_quality_check'].includes(status)) return 'border-yellow-200 bg-yellow-50 text-yellow-700';
  if (['quality_failed', 'reworking', 'abnormal'].includes(status)) return 'border-red-200 bg-red-50 text-red-700';
  if (['assigned'].includes(status)) return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-gray-200 bg-gray-50 text-gray-600';
}

export default function ProductionTasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [status, setStatus] = useState('all');
  const [taskType, setTaskType] = useState('all');
  const [filterWorkerId, setFilterWorkerId] = useState('all');
  const [assigneeWorkerId, setAssigneeWorkerId] = useState('');
  const [workstationId, setWorkstationId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [auditTask, setAuditTask] = useState<TaskRow | null>(null);
  const [auditAction, setAuditAction] = useState<'approve' | 'rework' | 'abnormal'>('approve');
  const [auditRemark, setAuditRemark] = useState('');

  const loadTasks = async () => {
    const params = new URLSearchParams({ pageSize: '100' });
    if (status !== 'all') params.set('status', status);
    if (taskType !== 'all') params.set('task_type', taskType);
    if (filterWorkerId !== 'all') params.set('worker_id', filterWorkerId);
    if (workstationId.trim()) params.set('workstation_id', workstationId.trim());
    if (keyword.trim()) params.set('keyword', keyword.trim());
    const res = await fetch(`/api/production/tasks?${params}`);
    const json = await res.json();
    if (json.success) setTasks(json.data || []);
    else toast.error(json.error || '获取生产任务失败');
  };

  const loadWorkers = async (taskId?: string) => {
    const params = new URLSearchParams();
    if (taskId) params.set('task_id', taskId);
    const res = await fetch(`/api/production/eligible-workers?${params}`).catch(() => null);
    if (!res?.ok) return;
    const json = await res.json();
    if (json.success) setWorkers(json.data || []);
  };

  useEffect(() => {
    loadTasks().catch(() => null);
  }, [status, taskType, filterWorkerId, workstationId]);

  useEffect(() => {
    loadWorkers().catch(() => null);
  }, []);

  const visibleTasks = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return tasks;
    return tasks.filter((task) => {
      const haystack = [
        task.task_no,
        task.task_name,
        task.process_name,
        task.order?.order_no,
        task.order?.customer_name,
        task.space?.space_name,
        task.product?.product_name,
        task.worker?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(value);
    });
  }, [keyword, tasks]);

  const selectedAssignableTasks = visibleTasks
    .filter((task) => selectedIds.has(task.id) && ['pending_generate', 'pending_assign', 'assigned'].includes(task.status || ''));
  const selectedAssignableIds = selectedAssignableTasks.map((task) => task.id);
  const singleAssignableTaskId = selectedAssignableTasks.length === 1 ? selectedAssignableTasks[0].id : '';

  useEffect(() => {
    loadWorkers(singleAssignableTaskId || undefined).catch(() => null);
  }, [singleAssignableTaskId]);

  const assignTask = async (taskId: string) => {
    if (!assigneeWorkerId) return toast.error('请选择工人');
    setAssigning(taskId);
    const res = await fetch(`/api/production/tasks/${taskId}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_worker_id: assigneeWorkerId, workstation_id: workstationId.trim() || undefined }),
    });
    const json = await res.json();
    setAssigning(null);
    if (!json.success) return toast.error(json.error || '分配失败');
    toast.success('已分配');
    await loadTasks();
  };

  const batchAssign = async () => {
    if (!assigneeWorkerId) return toast.error('请选择工人');
    if (selectedAssignableIds.length === 0) return toast.error('请选择待分配任务');
    setAssigning('batch');
    for (const taskId of selectedAssignableIds) {
      const res = await fetch(`/api/production/tasks/${taskId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_worker_id: assigneeWorkerId, workstation_id: workstationId.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        setAssigning(null);
        return toast.error(json.error || '批量分配失败');
      }
    }
    setAssigning(null);
    setSelectedIds(new Set());
    toast.success(`已分配 ${selectedAssignableIds.length} 个任务`);
    await loadTasks();
  };

  const openAudit = (task: TaskRow, action: 'approve' | 'rework' | 'abnormal') => {
    setAuditTask(task);
    setAuditAction(action);
    setAuditRemark('');
  };

  const submitAudit = async () => {
    if (!auditTask) return;
    const endpoint = auditAction === 'approve' ? 'review' : auditAction;
    const res = await fetch(`/api/production/tasks/${auditTask.id}/${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: auditAction, remark: auditRemark.trim() || undefined }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '审核失败');
    toast.success(auditAction === 'approve' ? '已审核通过' : auditAction === 'rework' ? '已驳回返工' : '已标记异常');
    setAuditTask(null);
    await loadTasks();
  };

  const toggleSelected = (taskId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const allVisibleSelected = visibleTasks.length > 0 && visibleTasks.every((task) => selectedIds.has(task.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">生产任务</h1>
        <p className="text-sm text-muted-foreground">围绕订单树分配任务、跟踪状态并审核工人提交。</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[150px_150px_180px_180px_1fr_auto] lg:items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((item) => <SelectItem key={item} value={item}>{TASK_STATUS_LABELS[item] || item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={taskType} onValueChange={setTaskType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map((item) => <SelectItem key={item} value={item}>{TASK_TYPE_LABELS[item] || item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterWorkerId} onValueChange={setFilterWorkerId}>
            <SelectTrigger><SelectValue placeholder="按工人筛选" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部工人</SelectItem>
              {workers.map((worker) => <SelectItem key={worker.id} value={worker.id}>{worker.worker_no || '-'} · {worker.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={workstationId} onChange={(event) => setWorkstationId(event.target.value)} placeholder="工位编号" />
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter') void loadTasks();
          }} placeholder="搜索订单号、客户、空间、产品、任务或工人..." />
          <Button variant="outline" onClick={() => loadTasks()}>搜索</Button>
        </CardContent>
        <CardContent className="grid gap-3 border-t p-4 md:grid-cols-[260px_1fr_auto] md:items-center">
          <Select value={assigneeWorkerId} onValueChange={setAssigneeWorkerId}>
            <SelectTrigger><SelectValue placeholder="选择分配工人" /></SelectTrigger>
            <SelectContent>
              {workers.map((worker) => (
                <SelectItem key={worker.id} value={worker.id}>
                  {worker.worker_no || '-'} · {worker.name}{worker.match_reasons?.length ? `（${worker.match_reasons.join('、')}）` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">
            {singleAssignableTaskId ? '已按当前选中任务推荐工人。' : '批量分配时会逐个校验工人是否可接任务。'}
          </div>
          <Button onClick={batchAssign} disabled={assigning === 'batch' || selectedAssignableIds.length === 0}>
            批量分配{selectedAssignableIds.length ? ` ${selectedAssignableIds.length}` : ''}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">任务列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => {
                    const nextChecked = checked === true;
                    setSelectedIds(nextChecked ? new Set(visibleTasks.map((task) => task.id)) : new Set());
                  }} />
                </TableHead>
                <TableHead>任务编号</TableHead>
                <TableHead>订单 / 客户</TableHead>
                <TableHead>空间 / 产品</TableHead>
                <TableHead>任务</TableHead>
                <TableHead>工人</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">工资估算</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(task.id)} onCheckedChange={(checked) => toggleSelected(task.id, checked === true)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{task.task_no || '-'}</TableCell>
                  <TableCell>
                    <div className="font-medium">{task.order?.order_no || '-'}</div>
                    <div className="text-xs text-muted-foreground">{task.order?.customer_name || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <div>{task.space?.space_name || '-'}</div>
                    <div className="text-xs text-muted-foreground">{task.product?.product_name || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{task.task_name || '-'}</div>
                    <div className="text-xs text-muted-foreground">{task.process_name || task.task_type || '-'} · {task.quantity || 0} {task.unit || ''}</div>
                  </TableCell>
                  <TableCell>
                    <div>{task.worker?.name || '-'}</div>
                    <div className="text-xs text-muted-foreground">{task.workstation_id || '-'}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={cn(statusClass(task.status))}>{TASK_STATUS_LABELS[task.status || ''] || task.status}</Badge></TableCell>
                  <TableCell className="text-right">{task.estimated_wage_amount !== undefined ? wage(task.estimated_wage_amount) : '待配置'}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setDetailTask(task)}>详情</Button>
                    {['pending_generate', 'pending_assign', 'assigned'].includes(task.status || '') ? (
                      <Button size="sm" variant="outline" disabled={assigning === task.id} onClick={() => assignTask(task.id)}>分配</Button>
                    ) : null}
                    {task.status === 'submitted' ? (
                      <>
                        <Button size="sm" onClick={() => openAudit(task, 'approve')}>通过</Button>
                        <Button size="sm" variant="outline" onClick={() => openAudit(task, 'rework')}>返工</Button>
                        <Button size="sm" variant="destructive" onClick={() => openAudit(task, 'abnormal')}>异常</Button>
                      </>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibleTasks.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">暂无生产任务</div> : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detailTask)} onOpenChange={(open) => !open && setDetailTask(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>任务详情</DialogTitle></DialogHeader>
          {detailTask ? (
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <Detail label="任务编号" value={detailTask.task_no} />
              <Detail label="任务名称" value={detailTask.task_name} />
              <Detail label="订单" value={`${detailTask.order?.order_no || '-'} / ${detailTask.order?.customer_name || '-'}`} />
              <Detail label="空间 / 产品" value={`${detailTask.space?.space_name || '-'} / ${detailTask.product?.product_name || '-'}`} />
              <Detail label="任务类型" value={TASK_TYPE_LABELS[detailTask.task_type || ''] || detailTask.task_type} />
              <Detail label="工序" value={detailTask.process_name} />
              <Detail label="数量" value={`${detailTask.quantity || 0} ${detailTask.unit || ''}`} />
              <Detail label="尺寸" value={`${detailTask.length || '-'} × ${detailTask.width || '-'} × ${detailTask.thickness || '-'}`} />
              <Detail label="材质" value={detailTask.material} />
              <Detail label="颜色" value={detailTask.color} />
              <Detail label="工人 / 工位" value={`${detailTask.worker?.name || '-'} / ${detailTask.workstation_id || '-'}`} />
              <Detail label="提交时间" value={detailTask.submitted_at ? new Date(detailTask.submitted_at).toLocaleString('zh-CN') : '-'} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(auditTask)} onOpenChange={(open) => !open && setAuditTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{auditAction === 'approve' ? '审核通过' : auditAction === 'rework' ? '驳回返工' : '标记异常'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{auditTask?.task_no} · {auditTask?.task_name}</div>
            <Textarea value={auditRemark} onChange={(event) => setAuditRemark(event.target.value)} placeholder="填写审核说明、返工原因或异常原因" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditTask(null)}>取消</Button>
            <Button variant={auditAction === 'abnormal' ? 'destructive' : 'default'} onClick={submitAudit}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || '-'}</div>
    </div>
  );
}
