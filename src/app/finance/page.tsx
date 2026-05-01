'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  TrendingDown,
  Wallet,
  CreditCard,
  Receipt,
  Download,
} from 'lucide-react';

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('overview');

  const summaryData = [
    {
      title: '本月收入',
      value: '¥128,500',
      change: '+12.5%',
      trend: 'up',
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: '本月支出',
      value: '¥86,200',
      change: '-8.3%',
      trend: 'down',
      icon: TrendingDown,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: '应收账款',
      value: '¥45,800',
      change: '待收款',
      trend: 'neutral',
      icon: Wallet,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: '应付账款',
      value: '¥32,500',
      change: '待付款',
      trend: 'neutral',
      icon: CreditCard,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  const recentTransactions = [
    { id: 1, date: '2024-01-15', description: '订单 #ORD-2024-001 收款', amount: 12500, type: 'income' },
    { id: 2, date: '2024-01-14', description: '原材料采购', amount: -8500, type: 'expense' },
    { id: 3, date: '2024-01-13', description: '订单 #ORD-2024-002 收款', amount: 28000, type: 'income' },
    { id: 4, date: '2024-01-12', description: '设备维护费', amount: -3200, type: 'expense' },
    { id: 5, date: '2024-01-11', description: '订单 #ORD-2024-003 收款', amount: 15600, type: 'income' },
  ];

  const invoices = [
    { id: 'INV-2024-001', customer: '青崖客户A', amount: 12500, status: 'paid', date: '2024-01-15' },
    { id: 'INV-2024-002', customer: '青崖客户B', amount: 28000, status: 'pending', date: '2024-01-13' },
    { id: 'INV-2024-003', customer: '青崖客户C', amount: 15600, status: 'pending', date: '2024-01-11' },
    { id: 'INV-2024-004', customer: '青崖客户D', amount: 9800, status: 'overdue', date: '2024-01-08' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">财务管理</h1>
              <p className="text-muted-foreground mt-1">查看和管理您的财务数据</p>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                <Download className="h-4 w-4" />
                导出报表
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryData.map((item) => (
              <Card key={item.title}>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className={item.trend === 'up' ? 'text-green-500' : item.trend === 'down' ? 'text-orange-500' : 'text-blue-500'}>
                      {item.change}
                    </span>
                    {' '}较上月
                  </p>
                </CardContent>
              </Card>
            ))}
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
                  <CardTitle>收支趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center bg-muted/50 rounded-lg">
                    <div className="text-center text-muted-foreground">
                      <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>图表区域</p>
                      <p className="text-sm">展示每月收支趋势变化</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>最近交易</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead>金额</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium">{tx.date}</TableCell>
                          <TableCell>{tx.description}</TableCell>
                          <TableCell className={tx.amount > 0 ? 'text-green-500' : 'text-orange-500'}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>发票列表</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>发票号</TableHead>
                        <TableHead>客户</TableHead>
                        <TableHead>日期</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.id}</TableCell>
                          <TableCell>{invoice.customer}</TableCell>
                          <TableCell>{invoice.date}</TableCell>
                          <TableCell>¥{invoice.amount.toLocaleString()}</TableCell>
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
                              {invoice.status === 'paid' ? '已支付' : invoice.status === 'pending' ? '待支付' : '逾期'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
