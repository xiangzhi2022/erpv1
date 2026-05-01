'use client';

import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

const progressData = [
  { id: 'P001', order: '某某家园1-2-2004', total: 100, completed: 75, status: '生产中' },
  { id: 'P002', order: '某某家园1-2-2005', total: 100, completed: 45, status: '生产中' },
  { id: 'P003', order: '某某家园1-2-201', total: 100, completed: 100, status: '已完成' },
  { id: 'P004', order: '某某家园1-2-202', total: 100, completed: 20, status: '刚启动' },
];

const statusColors: Record<string, string> = {
  '已完成': 'bg-green-500',
  '生产中': 'bg-blue-500',
  '刚启动': 'bg-orange-500',
  '待排产': 'bg-gray-500',
};

export default function ProgressPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">进度管理</h1>
            <p className="text-muted-foreground mt-1">跟踪和管理生产进度</p>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>订单编号</Label>
                  <Input placeholder="请输入订单编号" />
                </div>
                <div className="space-y-2">
                  <Label>订单名称</Label>
                  <Input placeholder="请输入订单名称" />
                </div>
                <div className="space-y-2">
                  <Label>下单日期</Label>
                  <Input type="date" />
                </div>
                <div className="flex items-end">
                  <Button className="w-full">搜索</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress List */}
          <Card>
            <CardHeader>
              <CardTitle>生产进度列表</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {progressData.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{item.id}</span>
                        <span className="font-medium">{item.order}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${statusColors[item.status]}`}>
                          {item.status}
                        </span>
                        <span className="text-sm text-muted-foreground">{item.completed}%</span>
                      </div>
                    </div>
                    <Progress value={item.completed} className="h-2" />
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>开始时间：2024-10-15</span>
                      <span>预计完成：2024-10-30</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
