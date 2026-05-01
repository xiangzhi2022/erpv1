'use client';

import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Package, Clock, CheckCircle2, TrendingUp } from 'lucide-react';

const stats = [
  {
    title: '待接收订单',
    value: '3',
    description: '查看明细',
    icon: FileText,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    title: '未排产订单池',
    value: '10',
    description: '查看明细',
    icon: Package,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: '生产中订单',
    value: '8',
    description: '查看明细',
    icon: Clock,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    title: '当月完工单量',
    value: '50',
    description: '查看明细',
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
];

const recentOrders = [
  { id: '20221019009', dealer: '某某某全屋定制', order: '某某家园1-2-2004', date: '2022-10-15 14:14', status: '待接收' },
  { id: '20221019008', dealer: '某某某全屋定制', order: '某某家园1-2-2005', date: '2022-10-16 14:14', status: '已退回' },
  { id: '20221019004', dealer: '某某某全屋定制', order: '某某家园1-2-201', date: '2022-10-17 15:17', status: '已接收' },
  { id: '20221019003', dealer: '某某某全屋定制', order: '某某家园1-2-201', date: '2022-10-19 9:11', status: '订单池' },
  { id: '20221019002', dealer: '某某某全屋定制', order: '某某家园1-2-201', date: '2022-10-20 8:33', status: '生产中' },
  { id: '20221019001', dealer: '某某某全屋定制', order: '某某家园1-2-201', date: '2022-10-20 13:17', status: '已发货' },
];

const statusColors: Record<string, string> = {
  '待接收': 'bg-orange-100 text-orange-700',
  '已退回': 'bg-red-100 text-red-700',
  '已接收': 'bg-blue-100 text-blue-700',
  '订单池': 'bg-purple-100 text-purple-700',
  '生产中': 'bg-yellow-100 text-yellow-700',
  '已发货': 'bg-green-100 text-green-700',
};

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">数字看板</h1>
              <p className="text-muted-foreground mt-1">实时查看生产管理系统各项数据</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>数据更新时间：{new Date().toLocaleString('zh-CN')}</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.title} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                    <stat.icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{stat.value}</div>
                  <Button variant="link" className="p-0 h-auto text-sm text-primary mt-2">
                    {stat.description}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle>订单状态一览</CardTitle>
              <CardDescription>最近的生产订单状态</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">序号</th>
                      <th className="text-left py-3 px-4 font-medium">经销商名称</th>
                      <th className="text-left py-3 px-4 font-medium">订单名称</th>
                      <th className="text-left py-3 px-4 font-medium">下单日期</th>
                      <th className="text-left py-3 px-4 font-medium">状态</th>
                      <th className="text-left py-3 px-4 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order, index) => (
                      <tr key={order.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">{index + 1}</td>
                        <td className="py-3 px-4">{order.dealer}</td>
                        <td className="py-3 px-4">{order.order}</td>
                        <td className="py-3 px-4 text-muted-foreground">{order.date}</td>
                        <td className="py-3 px-4">
                          <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusColors[order.status])}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Button variant="link" className="text-primary p-0 h-auto text-sm">
                            查看详情
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">当前显示 1 到 6 条，共 6 条记录</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled>第一页</Button>
                  <Button variant="outline" size="sm" disabled>上一页</Button>
                  <Button variant="secondary" size="sm">1</Button>
                  <Button variant="outline" size="sm" disabled>下一页</Button>
                  <Button variant="outline" size="sm" disabled>最后一页</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
