'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Loader2, RefreshCw, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface Tenant {
  id: string;
  name?: string | null;
  company_name?: string | null;
  tenant_type?: string | null;
}

interface OrderOption {
  id: string;
  order_no: string;
  customer_name: string;
  status: string;
}

interface Exchange {
  id: string;
  order_id: string;
  from_tenant_id: string;
  to_tenant_id: string;
  status: string;
  message?: string | null;
  proposed_changes?: unknown;
  handled_at?: string | null;
  created_at: string;
  order?: {
    id: string;
    order_no: string;
    customer_name: string;
    status: string;
    total_amount?: string | number | null;
    delivery_date?: string | null;
  } | null;
  from_tenant?: Tenant | null;
  to_tenant?: Tenant | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  sent: '已发起',
  accepted: '已接受',
  change_requested: '请求修改',
  rejected: '已拒绝',
  cancelled: '已取消',
  completed: '已完成',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  sent: 'default',
  accepted: 'default',
  change_requested: 'secondary',
  rejected: 'destructive',
  cancelled: 'outline',
  completed: 'secondary',
};

function tenantName(tenant?: Tenant | null): string {
  return tenant?.company_name || tenant?.name || tenant?.id || '-';
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

export default function OrderExchangesPage() {
  const [box, setBox] = useState('all');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [partners, setPartners] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ order_id: '', to_tenant_id: '', message: '' });

  const fetchExchanges = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/order-exchanges?box=${box}`);
      const data = await response.json();
      if (data.success) setExchanges(data.exchanges || []);
      else toast.error(data.error || '获取订单流转失败');
    } catch {
      toast.error('获取订单流转失败');
    } finally {
      setLoading(false);
    }
  }, [box]);

  const fetchOptions = useCallback(async () => {
    try {
      const [ordersRes, partnersRes] = await Promise.all([
        fetch('/api/orders?pageSize=100'),
        fetch('/api/order-exchanges/partners'),
      ]);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        if (data.success) setOrders(data.data || []);
      }
      if (partnersRes.ok) {
        const data = await partnersRes.json();
        if (data.success) setPartners(data.partners || []);
      }
    } catch {
      // The exchange list remains useful even if dropdown options fail.
    }
  }, []);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const counts = useMemo(() => {
    return exchanges.reduce<Record<string, number>>((acc, exchange) => {
      acc[exchange.status] = (acc[exchange.status] || 0) + 1;
      return acc;
    }, {});
  }, [exchanges]);

  const createExchange = async () => {
    if (!form.order_id || !form.to_tenant_id) {
      toast.error('请选择订单和接收企业');
      return;
    }
    setCreating(true);
    try {
      const response = await fetch('/api/order-exchanges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('订单流转已发起');
        setCreateOpen(false);
        setForm({ order_id: '', to_tenant_id: '', message: '' });
        fetchExchanges();
      } else {
        toast.error(data.error || '发起失败');
      }
    } catch {
      toast.error('发起失败');
    } finally {
      setCreating(false);
    }
  };

  const act = async (exchange: Exchange, action: 'accept' | 'request_change' | 'reject' | 'cancel') => {
    const message = action === 'request_change' ? window.prompt('请输入修改要求') : action === 'reject' ? window.prompt('请输入拒绝原因（可选）') : '';
    if (message === null) return;

    try {
      const response = await fetch(`/api/order-exchanges/${exchange.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('订单流转已更新');
        fetchExchanges();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('操作失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">订单流转</h1>
          <p className="mt-1 text-sm text-muted-foreground">处理企业之间的订单发起、接收、修改请求和拒绝。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchExchanges} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Send className="mr-2 h-4 w-4" />
            发起流转
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['全部', exchanges.length],
          ['待处理', counts.sent || 0],
          ['请求修改', counts.change_requested || 0],
          ['已接受', counts.accepted || 0],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className="mt-2 text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={box} onValueChange={setBox}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="inbox">收件箱</TabsTrigger>
          <TabsTrigger value="outbox">发件箱</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载订单流转...
        </div>
      ) : exchanges.length === 0 ? (
        <Card>
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            暂无订单流转记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {exchanges.map((exchange) => (
            <Card key={exchange.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ArrowRightLeft className="h-5 w-5 text-primary" />
                      {exchange.order?.order_no || exchange.order_id}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {exchange.order?.customer_name || '未知客户'} · {tenantName(exchange.from_tenant)} → {tenantName(exchange.to_tenant)}
                    </CardDescription>
                  </div>
                  <Badge variant={STATUS_VARIANTS[exchange.status] || 'outline'}>
                    {STATUS_LABELS[exchange.status] || exchange.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <div>
                    <div className="text-xs text-muted-foreground">订单状态</div>
                    <div className="mt-1 font-medium">{exchange.order?.status || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">发起时间</div>
                    <div className="mt-1 font-medium">{formatDate(exchange.created_at)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">处理时间</div>
                    <div className="mt-1 font-medium">{formatDate(exchange.handled_at)}</div>
                  </div>
                </div>
                {exchange.message ? (
                  <div className="rounded-lg bg-muted/40 p-3 text-sm">{exchange.message}</div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => act(exchange, 'accept')} disabled={exchange.status !== 'sent' && exchange.status !== 'change_requested'}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    接受
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(exchange, 'request_change')} disabled={exchange.status !== 'sent'}>
                    请求修改
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => act(exchange, 'reject')} disabled={exchange.status !== 'sent' && exchange.status !== 'change_requested'}>
                    <XCircle className="mr-1 h-4 w-4" />
                    拒绝
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(exchange, 'cancel')} disabled={!['draft', 'sent', 'change_requested'].includes(exchange.status)}>
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发起订单流转</DialogTitle>
            <DialogDescription>选择一个本企业订单和接收企业，对方可接受、请求修改或拒绝。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>订单</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.order_id} onChange={(event) => setForm((value) => ({ ...value, order_id: event.target.value }))}>
                <option value="">请选择订单</option>
                {orders.map((order) => <option key={order.id} value={order.id}>{order.order_no} · {order.customer_name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>接收企业</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.to_tenant_id} onChange={(event) => setForm((value) => ({ ...value, to_tenant_id: event.target.value }))}>
                <option value="">请选择接收企业</option>
                {partners.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenantName(tenant)} · {tenant.tenant_type || '-'}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>说明</Label>
              <Textarea value={form.message} onChange={(event) => setForm((value) => ({ ...value, message: event.target.value }))} placeholder="填写订单要求、交付说明或协作备注" />
            </div>
            {orders.length === 0 || partners.length === 0 ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                需要先有可访问订单和协作企业，才能发起订单流转。
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={createExchange} disabled={creating || !form.order_id || !form.to_tenant_id}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              发起
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
