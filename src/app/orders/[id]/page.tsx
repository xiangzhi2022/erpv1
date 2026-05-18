'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Factory,
  Hammer,
  Layers3,
  Package,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
  length?: number | string | null;
  width?: number | string | null;
  thickness?: number | string | null;
  area?: number | string | null;
  material?: string | null;
  color?: string | null;
  remark?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  estimated_wage_amount?: number | string;
  final_wage_amount?: number | string;
  worker?: { name?: string; worker_no?: string } | null;
}

interface ProductRow {
  id: string;
  product_no?: string;
  product_name?: string;
  product_type?: string;
  status?: string;
  quantity?: number | string;
  width?: number | string | null;
  height?: number | string | null;
  depth?: number | string | null;
  area?: number | string | null;
  material?: string | null;
  color?: string | null;
  remark?: string | null;
  quoted_amount?: number | string;
  cost_amount?: number | string;
  profit_amount?: number | string;
  production_tasks?: TaskRow[];
}

interface SpaceRow {
  id: string;
  space_no?: string;
  space_name?: string;
  space_type?: string;
  status?: string;
  remark?: string | null;
  products?: ProductRow[];
}

interface OrderTree {
  id: string;
  order_no?: string;
  customer_name?: string;
  customer_phone?: string;
  status?: string;
  total_amount?: number | string;
  cost_amount?: number | string;
  profit_amount?: number | string;
  delivery_date?: string;
  created_at?: string;
  remark?: string;
  external_progress?: string;
  spaces?: SpaceRow[];
  status_logs?: Array<{ id: string; target_type?: string; from_status?: string; to_status?: string; changed_at?: string; remark?: string }>;
}

type SelectedNode =
  | { type: 'order'; id: string }
  | { type: 'space'; id: string }
  | { type: 'product'; id: string }
  | { type: 'task'; id: string };

type SelectedData =
  | { type: 'order'; item: OrderTree }
  | { type: 'space'; item: SpaceRow }
  | { type: 'product'; item: ProductRow; space: SpaceRow }
  | { type: 'task'; item: TaskRow; product: ProductRow; space: SpaceRow };

const TASK_STATUS_LABELS: Record<string, string> = {
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
  cancelled: '已取消',
  abnormal: '异常',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待接收',
  returned: '已退回',
  confirmed: '已接收',
  pool: '待排产',
  producing: '生产中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  ready_to_ship: '待发货',
};

function formatCents(value: number | string | undefined): string {
  if (value === undefined || value === null) return '-';
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return `¥${(parsed / 100).toFixed(2)}`;
}

function formatYuan(value: number | string | undefined): string {
  if (value === undefined || value === null) return '-';
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return `¥${parsed.toFixed(2)}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string | undefined): string {
  if (!status) return '-';
  return TASK_STATUS_LABELS[status] || ORDER_STATUS_LABELS[status] || status;
}

function statusClass(status: string | undefined): string {
  if (!status) return 'border-gray-200 bg-gray-50 text-gray-600';
  if (['completed', 'quality_passed', 'shipped'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['producing', 'pool'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (['submitted', 'pending_quality_check'].includes(status)) return 'border-violet-200 bg-violet-50 text-violet-700';
  if (['abnormal', 'quality_failed', 'reworking', 'returned', 'cancelled'].includes(status)) return 'border-red-200 bg-red-50 text-red-700';
  if (['assigned', 'confirmed'].includes(status)) return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-gray-200 bg-gray-50 text-gray-600';
}

function allTasks(order: OrderTree): TaskRow[] {
  return (order.spaces || []).flatMap((space) => (space.products || []).flatMap((product) => product.production_tasks || []));
}

function progressFromTasks(tasks: TaskRow[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((task) => ['completed', 'quality_passed'].includes(task.status || '')).length;
  return Math.round((done / tasks.length) * 100);
}

function sizeText(values: Array<number | string | null | undefined>): string {
  const parts = values.filter((value) => value !== null && value !== undefined && value !== '');
  return parts.length ? parts.join(' × ') : '-';
}

function getSelectedData(order: OrderTree, selected: SelectedNode | null): SelectedData {
  if (!selected || selected.type === 'order') return { type: 'order', item: order };
  for (const space of order.spaces || []) {
    if (selected.type === 'space' && space.id === selected.id) return { type: 'space', item: space };
    for (const product of space.products || []) {
      if (selected.type === 'product' && product.id === selected.id) return { type: 'product', item: product, space };
      for (const task of product.production_tasks || []) {
        if (selected.type === 'task' && task.id === selected.id) return { type: 'task', item: task, product, space };
      }
    }
  }
  return { type: 'order', item: order };
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    fetch(`/api/orders/${params.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!mounted || !json.success) return;
        const nextOrder = json.data as OrderTree;
        setOrder(nextOrder);
        setSelected({ type: 'order', id: nextOrder.id });
        const keys = new Set<string>(['order']);
        (nextOrder.spaces || []).forEach((space) => {
          keys.add(`space:${space.id}`);
          (space.products || []).forEach((product) => keys.add(`product:${product.id}`));
        });
        setExpanded(keys);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [params.id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">加载订单详情...</div>;
  if (!order) return <div className="p-6 text-sm text-muted-foreground">订单不存在或无权查看。</div>;

  const tasks = allTasks(order);
  const progress = progressFromTasks(tasks);
  const isExternalOnly = (order.spaces || []).length === 0;
  const selectedData = getSelectedData(order, selected);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/orders" className="hover:text-foreground">订单管理</Link>
            <ChevronRight className="h-4 w-4" />
            <span>{order.order_no}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{order.customer_name || order.order_no}</h1>
          <p className="mt-1 text-sm text-muted-foreground">外部进度：{order.external_progress || statusLabel(order.status)}</p>
        </div>
        <div className="flex gap-2">
          {!isExternalOnly ? (
            <Button asChild variant="outline">
              <Link href={`/orders/${order.id}/split`}>拆单</Link>
            </Button>
          ) : null}
          <Badge variant="outline" className={cn('h-9 px-3 text-sm', statusClass(order.status))}>{statusLabel(order.status)}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <InfoCard icon={<ClipboardList className="h-4 w-4" />} label="订单号" value={order.order_no || '-'} />
        <InfoCard icon={<UserRound className="h-4 w-4" />} label="客户电话" value={order.customer_phone || '-'} />
        <InfoCard icon={<Package className="h-4 w-4" />} label="生产进度" value={`${progress}%`} />
        <InfoCard icon={<Factory className="h-4 w-4" />} label="交付日期" value={order.delivery_date || '-'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card className="min-h-[520px]">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between text-base">
              四级订单树
              <span className="text-xs font-normal text-muted-foreground">{tasks.length} 个任务</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            <TreeButton
              active={selected?.type === 'order'}
              depth={0}
              icon={<ClipboardList className="h-4 w-4" />}
              label={order.order_no || '订单'}
              meta={order.customer_name || statusLabel(order.status)}
              onClick={() => setSelected({ type: 'order', id: order.id })}
            />
            {isExternalOnly ? (
              <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                当前视图仅展示经销商外部进度，不显示工厂内部生产任务树。
              </div>
            ) : null}
            {(order.spaces || []).map((space) => {
              const spaceKey = `space:${space.id}`;
              const spaceOpen = expanded.has(spaceKey);
              return (
                <div key={space.id}>
                  <TreeButton
                    active={selected?.type === 'space' && selected.id === space.id}
                    depth={1}
                    icon={<Layers3 className="h-4 w-4" />}
                    label={space.space_name || space.space_no || '空间'}
                    meta={statusLabel(space.status)}
                    expanded={spaceOpen}
                    onToggle={() => toggle(spaceKey)}
                    onClick={() => setSelected({ type: 'space', id: space.id })}
                  />
                  {spaceOpen ? (space.products || []).map((product) => {
                    const productKey = `product:${product.id}`;
                    const productOpen = expanded.has(productKey);
                    return (
                      <div key={product.id}>
                        <TreeButton
                          active={selected?.type === 'product' && selected.id === product.id}
                          depth={2}
                          icon={<Package className="h-4 w-4" />}
                          label={product.product_name || product.product_no || '产品'}
                          meta={statusLabel(product.status)}
                          expanded={productOpen}
                          onToggle={() => toggle(productKey)}
                          onClick={() => setSelected({ type: 'product', id: product.id })}
                        />
                        {productOpen ? (product.production_tasks || []).map((task) => (
                          <TreeButton
                            key={task.id}
                            active={selected?.type === 'task' && selected.id === task.id}
                            depth={3}
                            icon={<Hammer className="h-4 w-4" />}
                            label={task.task_name || task.task_no || '生产任务'}
                            meta={statusLabel(task.status)}
                            onClick={() => setSelected({ type: 'task', id: task.id })}
                          />
                        )) : null}
                      </div>
                    );
                  }) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="min-h-[520px]">
          <CardHeader className="border-b">
            <CardTitle className="text-base">节点详情</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <DetailPanel data={selectedData} order={order} progress={progress} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">状态日志 / 操作记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(order.status_logs || []).slice(0, 30).map((log) => (
            <div key={log.id} className="text-sm">
              <div className="font-medium">{log.target_type}: {statusLabel(log.from_status || undefined)} {'->'} {statusLabel(log.to_status || undefined)}</div>
              <div className="text-xs text-muted-foreground">{formatDate(log.changed_at)} {log.remark || ''}</div>
              <Separator className="mt-3" />
            </div>
          ))}
          {(order.status_logs || []).length === 0 ? <div className="text-sm text-muted-foreground">暂无日志</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailPanel({ data, order, progress }: { data: SelectedData | null; order: OrderTree; progress: number }) {
  if (!data) return null;
  if (data.type === 'order') {
    const item = data.item;
    return (
      <div className="space-y-5">
        <PanelHeader title={item.customer_name || item.order_no || '订单'} badge={statusLabel(item.status)} status={item.status} />
        <ProgressBlock value={progress} />
        <DetailGrid>
          <Detail label="订单编号" value={item.order_no} />
          <Detail label="客户名称" value={item.customer_name} />
          <Detail label="客户电话" value={item.customer_phone} />
          <Detail label="预计交付" value={item.delivery_date || '-'} />
          <Detail label="创建时间" value={formatDate(item.created_at)} />
          <Detail label="备注" value={item.remark || '-'} />
        </DetailGrid>
        {item.total_amount !== undefined ? (
          <DetailGrid title="财务字段">
            <Detail label="订单总金额" value={formatCents(item.total_amount)} />
            <Detail label="成本金额" value={formatCents(item.cost_amount)} />
            <Detail label="利润金额" value={formatCents(item.profit_amount)} />
          </DetailGrid>
        ) : null}
      </div>
    );
  }
  if (data.type === 'space') {
    const item = data.item;
    const products = item.products || [];
    const tasks = products.flatMap((product) => product.production_tasks || []);
    return (
      <div className="space-y-5">
        <PanelHeader title={item.space_name || item.space_no || '空间'} badge={statusLabel(item.status)} status={item.status} />
        <ProgressBlock value={progressFromTasks(tasks)} />
        <DetailGrid>
          <Detail label="空间编号" value={item.space_no} />
          <Detail label="空间类型" value={item.space_type || '-'} />
          <Detail label="所属订单" value={order.order_no} />
          <Detail label="产品数量" value={String(products.length)} />
          <Detail label="任务数量" value={String(tasks.length)} />
          <Detail label="备注" value={item.remark || '-'} />
        </DetailGrid>
      </div>
    );
  }
  if (data.type === 'product') {
    const item = data.item;
    const tasks = item.production_tasks || [];
    return (
      <div className="space-y-5">
        <PanelHeader title={item.product_name || item.product_no || '产品'} badge={statusLabel(item.status)} status={item.status} />
        <ProgressBlock value={progressFromTasks(tasks)} />
        <DetailGrid>
          <Detail label="产品编号" value={item.product_no} />
          <Detail label="所属空间" value={data.space.space_name || data.space.space_no} />
          <Detail label="产品类型" value={item.product_type || '-'} />
          <Detail label="尺寸 mm" value={sizeText([item.height, item.width, item.depth])} />
          <Detail label="面积" value={item.area ? String(item.area) : '-'} />
          <Detail label="数量" value={String(item.quantity || '-')} />
          <Detail label="材质" value={item.material || '-'} />
          <Detail label="颜色" value={item.color || '-'} />
          <Detail label="任务数量" value={String(tasks.length)} />
          <Detail label="备注" value={item.remark || '-'} />
        </DetailGrid>
        {item.quoted_amount !== undefined ? (
          <DetailGrid title="财务字段">
            <Detail label="报价金额" value={formatCents(item.quoted_amount)} />
            <Detail label="成本金额" value={formatCents(item.cost_amount)} />
            <Detail label="利润金额" value={formatCents(item.profit_amount)} />
          </DetailGrid>
        ) : null}
      </div>
    );
  }
  const item = data.item;
  return (
    <div className="space-y-5">
      <PanelHeader title={item.task_name || item.task_no || '生产任务'} badge={statusLabel(item.status)} status={item.status} />
      <DetailGrid>
        <Detail label="任务编号" value={item.task_no} />
        <Detail label="所属订单" value={order.order_no} />
        <Detail label="所属空间" value={data.space.space_name || data.space.space_no} />
        <Detail label="所属产品" value={data.product.product_name || data.product.product_no} />
        <Detail label="任务类型" value={item.task_type || '-'} />
        <Detail label="工序" value={item.process_name || '-'} />
        <Detail label="数量" value={`${item.quantity || 0} ${item.unit || ''}`} />
        <Detail label="尺寸 mm" value={sizeText([item.length, item.width, item.thickness])} />
        <Detail label="材质" value={item.material || '-'} />
        <Detail label="颜色" value={item.color || '-'} />
        <Detail label="负责人/工人" value={item.worker ? `${item.worker.worker_no || ''} ${item.worker.name || ''}`.trim() : '-'} />
        <Detail label="提交时间" value={formatDate(item.submitted_at)} />
        <Detail label="审核时间" value={formatDate(item.approved_at)} />
        <Detail label="备注" value={item.remark || '-'} />
      </DetailGrid>
      {item.estimated_wage_amount !== undefined || item.final_wage_amount !== undefined ? (
        <DetailGrid title="工资字段">
          <Detail label="预估工资" value={formatYuan(item.estimated_wage_amount)} />
          <Detail label="最终工资" value={formatYuan(item.final_wage_amount)} />
        </DetailGrid>
      ) : null}
    </div>
  );
}

function TreeButton({
  active,
  depth,
  icon,
  label,
  meta,
  expanded,
  onToggle,
  onClick,
}: {
  active: boolean;
  depth: number;
  icon: ReactNode;
  label: string;
  meta?: string;
  expanded?: boolean;
  onToggle?: () => void;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-1" style={{ paddingLeft: depth * 14 }}>
      {onToggle ? (
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          aria-label={expanded ? '收起' : '展开'}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ) : <span className="h-7 w-7" />}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted',
          active && 'bg-primary/10 text-primary'
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{label}</span>
          {meta ? <span className="block truncate text-xs text-muted-foreground">{meta}</span> : null}
        </span>
      </button>
    </div>
  );
}

function PanelHeader({ title, badge, status }: { title: string; badge: string; status?: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-xs text-muted-foreground">当前节点</div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <Badge variant="outline" className={cn('w-fit', statusClass(status))}>
        <CircleDot className="mr-1 h-3 w-3" />
        {badge}
      </Badge>
    </div>
  );
}

function ProgressBlock({ value }: { value: number }) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">完成进度</span>
        <span className="font-medium">{value}%</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function DetailGrid({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {title ? <div className="text-sm font-medium">{title}</div> : null}
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value || '-'}</div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon ? <div className="rounded-md bg-muted p-2">{icon}</div> : null}
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="truncate font-medium">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
