'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Hammer, Layers3, Loader2, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface TaskRow {
  id: string;
  task_no?: string;
  task_name?: string;
  task_type?: string;
  process_name?: string;
  quantity?: number | string;
  unit?: string;
  status?: string;
}

interface ProductRow {
  id: string;
  product_name?: string;
  product_no?: string;
  status?: string;
  production_tasks?: TaskRow[];
}

interface SpaceRow {
  id: string;
  space_name?: string;
  space_no?: string;
  status?: string;
  products?: ProductRow[];
}

interface OrderTree {
  id: string;
  order_no?: string;
  customer_name?: string;
  status?: string;
  spaces?: SpaceRow[];
}

const TASK_TYPES = [
  { value: 'board', label: '板件任务' },
  { value: 'door', label: '门板任务' },
  { value: 'hardware', label: '五金任务' },
  { value: 'process', label: '工序任务' },
  { value: 'install', label: '安装任务' },
  { value: 'package', label: '包装任务' },
  { value: 'delivery', label: '发货任务' },
];

function statusText(status: string | undefined): string {
  const map: Record<string, string> = {
    pending_generate: '待生成',
    pending_assign: '待分配',
    assigned: '已分配',
    producing: '生产中',
    submitted: '已提交',
    completed: '已完成',
    reworking: '返工中',
    pool: '待排产',
    pending: '待接收',
    confirmed: '已接收',
  };
  return status ? map[status] || status : '-';
}

export default function OrderSplitPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderTree | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [spaceRemark, setSpaceRemark] = useState('');
  const [productName, setProductName] = useState('');
  const [productType, setProductType] = useState('custom');
  const [selectedSpace, setSelectedSpace] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [taskName, setTaskName] = useState('');
  const [processName, setProcessName] = useState('');
  const [taskType, setTaskType] = useState('process');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('件');
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    const res = await fetch(`/api/orders/${params.id}`);
    const json = await res.json();
    if (json.success) {
      const nextOrder = json.data as OrderTree;
      setOrder(nextOrder);
      if (!selectedSpace && nextOrder.spaces?.[0]?.id) setSelectedSpace(nextOrder.spaces[0].id);
    } else {
      toast.error(json.error || '获取订单失败');
    }
  };

  useEffect(() => {
    refresh().catch(() => null);
  }, [params.id]);

  const products = useMemo(() => {
    const space = (order?.spaces || []).find((item) => item.id === selectedSpace);
    return space?.products || [];
  }, [order?.spaces, selectedSpace]);

  const pendingGenerateCount = useMemo(() => {
    return (order?.spaces || []).reduce((sum, space) => {
      return sum + (space.products || []).reduce((productSum, product) => {
        return productSum + (product.production_tasks || []).filter((task) => task.status === 'pending_generate').length;
      }, 0);
    }, 0);
  }, [order?.spaces]);

  const createSpace = async () => {
    const res = await fetch(`/api/orders/${params.id}/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ space_name: spaceName, remark: spaceRemark }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '新增空间失败');
    setSpaceName('');
    setSpaceRemark('');
    setSelectedSpace(json.data.id);
    toast.success('空间已新增');
    await refresh();
  };

  const createProduct = async () => {
    if (!selectedSpace) return toast.error('请先选择空间');
    const res = await fetch(`/api/spaces/${selectedSpace}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_name: productName, product_type: productType, quantity: 1 }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '新增产品失败');
    setProductName('');
    setSelectedProduct(json.data.id);
    toast.success('产品已新增');
    await refresh();
  };

  const createTask = async () => {
    if (!selectedProduct) return toast.error('请先选择产品');
    const res = await fetch(`/api/products/${selectedProduct}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_name: taskName,
        process_name: processName,
        task_type: taskType,
        quantity: Number(quantity || 1),
        unit,
      }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '新增任务失败');
    setTaskName('');
    setProcessName('');
    toast.success('生产任务已新增');
    await refresh();
  };

  const confirmSplit = async () => {
    setSubmitting(true);
    const res = await fetch(`/api/orders/${params.id}/split/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remark: '生产主管确认拆单' }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!json.success) return toast.error(json.error || '确认拆单失败');
    toast.success(json.updated_tasks > 0 ? `已确认 ${json.updated_tasks} 个生产任务` : '没有待确认任务');
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">订单拆单</h1>
          <p className="text-sm text-muted-foreground">{order?.order_no || params.id} · {order?.customer_name || ''}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href={`/orders/${params.id}`}>返回详情</Link></Button>
          <Button onClick={confirmSplit} disabled={submitting || pendingGenerateCount === 0} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            确认拆单
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card className="min-h-[560px]">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center justify-between text-base">
              当前订单结构
              <Badge variant="secondary">待确认 {pendingGenerateCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {(order?.spaces || []).length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">先创建空间，再继续创建产品和生产任务。</div>
            ) : null}
            {(order?.spaces || []).map((space) => (
              <div key={space.id} className="rounded-md border">
                <button
                  type="button"
                  onClick={() => setSelectedSpace(space.id)}
                  className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted', selectedSpace === space.id && 'bg-primary/10 text-primary')}
                >
                  <span className="flex items-center gap-2 font-medium"><Layers3 className="h-4 w-4" />{space.space_no} · {space.space_name}</span>
                  <span className="text-xs text-muted-foreground">{statusText(space.status)}</span>
                </button>
                <div className="space-y-2 border-t p-3">
                  {(space.products || []).map((product) => (
                    <div key={product.id} className="rounded-md bg-muted/40 p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSpace(space.id);
                          setSelectedProduct(product.id);
                        }}
                        className={cn('flex w-full items-center justify-between text-left text-sm', selectedProduct === product.id && 'text-primary')}
                      >
                        <span className="flex items-center gap-2"><Package className="h-4 w-4" />{product.product_no} · {product.product_name}</span>
                        <span className="text-xs">{statusText(product.status)}</span>
                      </button>
                      <div className="mt-2 space-y-1 pl-6 text-xs text-muted-foreground">
                        {(product.production_tasks || []).map((task) => (
                          <div key={task.id} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1"><Hammer className="h-3 w-3" />{task.task_no} · {task.task_name}</span>
                            <Badge variant="outline" className="h-5 text-[11px]">{statusText(task.status)}</Badge>
                          </div>
                        ))}
                        {(product.production_tasks || []).length === 0 ? <div>暂无生产任务</div> : null}
                      </div>
                    </div>
                  ))}
                  {(space.products || []).length === 0 ? <div className="text-sm text-muted-foreground">暂无产品</div> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">1. 创建空间</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>空间名称</Label>
              <Input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} placeholder="主卧 / 厨房 / 客厅" />
              <Label>备注</Label>
              <Textarea value={spaceRemark} onChange={(event) => setSpaceRemark(event.target.value)} placeholder="尺寸图、客户要求等" />
              <Button onClick={createSpace} disabled={!spaceName.trim()} className="w-full gap-2"><Plus className="h-4 w-4" />新增空间</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">2. 创建产品</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>所属空间</Label>
              <Select value={selectedSpace} onValueChange={setSelectedSpace}>
                <SelectTrigger><SelectValue placeholder="选择空间" /></SelectTrigger>
                <SelectContent>
                  {(order?.spaces || []).map((space) => <SelectItem key={space.id} value={space.id}>{space.space_no} · {space.space_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Label>产品类型</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="wardrobe">衣柜</SelectItem>
                  <SelectItem value="cabinet">柜体</SelectItem>
                  <SelectItem value="door">门类</SelectItem>
                  <SelectItem value="hardware">五金</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
              <Label>产品名称</Label>
              <Input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="衣柜 / 地柜 / 门板" />
              <Button onClick={createProduct} disabled={!selectedSpace || !productName.trim()} className="w-full gap-2"><Plus className="h-4 w-4" />新增产品</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">3. 创建生产任务</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>所属产品</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger><SelectValue placeholder="选择产品" /></SelectTrigger>
                <SelectContent>
                  {products.map((product) => <SelectItem key={product.id} value={product.id}>{product.product_no} · {product.product_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Label>任务类型</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Label>任务名称</Label>
              <Input value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="侧板 A / 封边 / 包装" />
              <Label>工序</Label>
              <Input value={processName} onChange={(event) => setProcessName(event.target.value)} placeholder="开料 / 封边 / 打孔" />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>数量</Label>
                  <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="1" />
                </div>
                <div className="space-y-2">
                  <Label>单位</Label>
                  <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="件 / 块 / 米" />
                </div>
              </div>
              <Button onClick={createTask} disabled={!selectedProduct || !taskName.trim()} className="w-full gap-2"><Plus className="h-4 w-4" />新增任务</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
