'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  TrendingUp,
  Wallet,
  CreditCard,
  Download,
  RefreshCw,
} from 'lucide-react';

// Status labels aligned with ORDER_STATUS_CONFIG in orders/schemas.ts
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待接收',
  returned: '已退回',
  confirmed: '已接收',
  pool: '订单池',
  producing: '生产中',
  in_production: '生产中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
};

// Completed-like statuses for revenue calculation
const REVENUE_STATUSES = ['shipped', 'completed'];
// In-progress statuses for pending revenue
const PENDING_REVENUE_STATUSES = ['confirmed', 'producing', 'in_production', 'pool'];

interface OrderStats {
  total: number;
  pending: number;
  returned: number;
  confirmed: number;
  pool: number;
  producing: number;
  shipped: number;
  completed: number;
  cancelled: number;
}

interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
}

const defaultStats: OrderStats = {
  total: 0,
  pending: 0,
  returned: 0,
  confirmed: 0,
  pool: 0,
  producing: 0,
  shipped: 0,
  completed: 0,
  cancelled: 0,
};

export default function FinancePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOrders(data.data || []);
          setStats(data.stats || defaultStats);
        }
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Compute revenue from full order list
  const totalRevenue = orders
    .filter(o => REVENUE_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const pendingRevenue = orders
    .filter(o => PENDING_REVENUE_STATUSES.includes(o.status))
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const completedOrdersCount = stats.shipped + stats.completed;
  // Producing includes in_production
  const producingCount = stats.producing + orders.filter(o => o.status === 'in_production').length;
  const pendingOrdersCount = stats.pending + stats.confirmed + producingCount + stats.pool;

  const summaryData = [
    {
      title: '已完成金额',
      value: `¥${(totalRevenue / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
      subtitle: `${completedOrdersCount} 笔订单`,
      trend: 'up' as const,
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: '待收款金额',
      value: `¥${(pendingRevenue / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
      subtitle: `${stats.shipped} 笔待确认`,
      trend: 'neutral' as const,
      icon: Wallet,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: '进行中订单',
      value: `${producingCount}`,
      subtitle: '生产中',
      trend: 'up' as const,
      icon: CreditCard,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: '待处理订单',
      value: `${pendingOrdersCount}`,
      subtitle: '需跟进',
      trend: 'down' as const,
      icon: DollarSign,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  // Format date safely (client-only to avoid hydration mismatch)
  const formatDateSafe = (dateStr: string | null): string => {
    if (!dateStr || !mounted) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  // Transaction records derived from orders
  const recentTransactions = useMemo(() =>
    orders.slice(0, 10).map(order => ({
      id: order.id,
      date: formatDateSafe(order.created_at),
      description: `订单 ${order.order_no}`,
      customer: order.customer_name || '-',
      amount: order.total_amount / 100,
      type: REVENUE_STATUSES.includes(order.status) ? 'income' as const : 'pending' as const,
      status: order.status,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, mounted]
  );

  // Invoice list - completed/shipped orders
  const invoices = useMemo(() =>
    orders
      .filter(o => REVENUE_STATUSES.includes(o.status))
      .map((order, index) => ({
        id: `INV-${mounted && order.created_at ? new Date(order.created_at).getFullYear() : new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`,
        customer: order.customer_name || '-',
        amount: order.total_amount / 100,
        status: order.status === 'completed' ? 'paid' : 'pending',
        date: formatDateSafe(order.created_at),
        orderNo: order.order_no,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, mounted]
  );

  // Export CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const csvRows = [
        ['订单编号', '客户名称', '金额', '状态', '创建日期'].join(','),
        ...orders.map(o =>
          [o.order_no, o.customer_name || '', (o.total_amount / 100).toFixed(2), ORDER_STATUS_LABELS[o.status] || o.status, o.created_at || ''].join(',')
        ),
      ];
      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `财务报表_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('导出失败');
    } finally {
      setExporting(false);
    }
  };

  // Amount distribution by status - aligned with orders module labels
  const amountDistribution = [
    { status: 'completed', label: '已完成', color: 'bg-green-500' },
    { status: 'shipped', label: '已发货', color: 'bg-blue-500' },
    { status: 'producing', label: '生产中', color: 'bg-yellow-500' },
    { status: 'confirmed', label: '已接收', color: 'bg-purple-500' },
    { status: 'pending', label: '待接收', color: 'bg-orange-500' },
    { status: 'returned', label: '已退回', color: 'bg-red-500' },
    { status: 'cancelled', label: '已取消', color: 'bg-gray-500' },
  ];

  return (
    <>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">财务管理</h1>
              <p className="text-muted-foreground mt-1">查看和管理您的财务数据</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchOrders}>
                <RefreshCw className="h-4 w-4 mr-1" /> 刷新
              </Button>
              <Button onClick={handleExport} disabled={exporting || orders.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                {exporting ? '导出中...' : '导出报表'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-7 w-32 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : (
              summaryData.map((item) => (
                <Card
                  key={item.title}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    if (item.title.includes('待处理')) router.push('/orders?status=pending');
                    else if (item.title.includes('进行中')) router.push('/progress');
                    else router.push('/orders');
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {item.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${item.bgColor}`}>
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{item.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{item.subtitle}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">收支概况</TabsTrigger>
              <TabsTrigger value="transactions">交易记录</TabsTrigger>
              <TabsTrigger value="invoices">发票管理</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>订单金额分布</CardTitle>
                    <Button variant="link" onClick={() => router.push('/orders')}>查看全部订单</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-lg">
                      <div className="text-center text-muted-foreground">
                        <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>暂无财务数据</p>
                        <Button variant="outline" className="mt-4" onClick={() => router.push('/orders')}>
                          去查看订单
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {amountDistribution.map(group => {
                        // Include in_production as producing equivalent
                        const groupOrders = orders.filter(o =>
                          o.status === group.status ||
                          (group.status === 'producing' && o.status === 'in_production')
                        );
                        const groupTotal = groupOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
                        if (groupOrders.length === 0) return null;
                        return (
                          <div
                            key={group.status}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/orders?status=${group.status}`)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full ${group.color}`} />
                              <span className="font-medium">{group.label}</span>
                              <span className="text-sm text-muted-foreground">{groupOrders.length} 单</span>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold">¥{(groupTotal / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>最近交易</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                      <Download className="h-3 w-3 mr-1" /> 导出
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>日期</TableHead>
                          <TableHead>订单</TableHead>
                          <TableHead>客户</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>类型</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentTransactions.map((tx) => (
                          <TableRow
                            key={tx.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => router.push('/orders')}
                          >
                            <TableCell className="font-medium">{tx.date}</TableCell>
                            <TableCell>{tx.description}</TableCell>
                            <TableCell>{tx.customer}</TableCell>
                            <TableCell className={tx.type === 'income' ? 'text-green-500' : 'text-orange-500'}>
                              {tx.type === 'income' ? '+' : ''}¥{tx.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={tx.type === 'income' ? 'default' : 'secondary'}>
                                {tx.type === 'income' ? '已收款' : '待收款'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>发票列表</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                      <Download className="h-3 w-3 mr-1" /> 导出
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>暂无发票数据</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>发票号</TableHead>
                          <TableHead>客户</TableHead>
                          <TableHead>关联订单</TableHead>
                          <TableHead>日期</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium">{invoice.id}</TableCell>
                            <TableCell>{invoice.customer}</TableCell>
                            <TableCell className="font-mono text-sm">{invoice.orderNo}</TableCell>
                            <TableCell>{invoice.date}</TableCell>
                            <TableCell>¥{invoice.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  invoice.status === 'paid'
                                    ? 'default'
                                    : invoice.status === 'pending'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                              >
                                {invoice.status === 'paid' ? '已支付' : '待支付'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </>
  );
}
