'use client';

import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const shippingData = [
  { id: 'S001', order: '某某家园1-2-2004', dealer: '某某某全屋定制', quantity: 50, shipDate: '2024-10-28', status: '待发货', tracking: '-' },
  { id: 'S002', order: '某某家园1-2-2003', dealer: '某某某全屋定制', quantity: 30, shipDate: '2024-10-25', status: '已发货', tracking: 'SF1234567890' },
  { id: 'S003', order: '某某家园1-2-2002', dealer: '某某某全屋定制', quantity: 45, shipDate: '2024-10-20', status: '已签收', tracking: 'YT9876543210' },
];

const statusColors: Record<string, string> = {
  '待发货': 'bg-orange-100 text-orange-700',
  '已发货': 'bg-blue-100 text-blue-700',
  '运输中': 'bg-purple-100 text-purple-700',
  '已签收': 'bg-green-100 text-green-700',
};

export default function ShippingPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">发货管理</h1>
            <p className="text-muted-foreground mt-1">管理订单发货和物流跟踪</p>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>经销商名称</Label>
                  <Input placeholder="请输入经销商名称" />
                </div>
                <div className="space-y-2">
                  <Label>订单名称</Label>
                  <Input placeholder="请输入订单名称" />
                </div>
                <div className="space-y-2">
                  <Label>发货状态</Label>
                  <Input placeholder="全部" />
                </div>
                <div className="flex items-end">
                  <Button className="w-full">搜索</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>发货列表</CardTitle>
                <Button>新建发货单</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">序号</th>
                      <th className="text-left py-3 px-4 font-medium">订单编号</th>
                      <th className="text-left py-3 px-4 font-medium">经销商名称</th>
                      <th className="text-left py-3 px-4 font-medium">订单名称</th>
                      <th className="text-left py-3 px-4 font-medium">数量</th>
                      <th className="text-left py-3 px-4 font-medium">发货日期</th>
                      <th className="text-left py-3 px-4 font-medium">物流单号</th>
                      <th className="text-left py-3 px-4 font-medium">状态</th>
                      <th className="text-left py-3 px-4 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shippingData.map((item, index) => (
                      <tr key={item.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{index + 1}</td>
                        <td className="py-3 px-4 font-mono text-sm">{item.id}</td>
                        <td className="py-3 px-4">{item.dealer}</td>
                        <td className="py-3 px-4">{item.order}</td>
                        <td className="py-3 px-4">{item.quantity}</td>
                        <td className="py-3 px-4 text-muted-foreground">{item.shipDate}</td>
                        <td className="py-3 px-4 font-mono text-sm">{item.tracking}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.status]}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">查看</Button>
                            {item.status === '待发货' && <Button size="sm">发货</Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">当前显示 1 到 3 条，共 3 条记录</p>
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
