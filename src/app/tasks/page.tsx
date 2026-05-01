'use client';

import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const taskStats = [
  { label: '待分配任务', value: 5, color: 'bg-orange-500' },
  { label: '进行中任务', value: 12, color: 'bg-blue-500' },
  { label: '已完成任务', value: 48, color: 'bg-green-500' },
  { label: '逾期任务', value: 2, color: 'bg-red-500' },
];

const tasks = [
  { id: 'T001', order: '某某家园1-2-2004', task: '柜体生产', assignee: '张三', deadline: '2024-10-25', status: '进行中' },
  { id: 'T002', order: '某某家园1-2-2005', task: '门板加工', assignee: '李四', deadline: '2024-10-26', status: '待分配' },
  { id: 'T003', order: '某某家园1-2-201', task: '五金安装', assignee: '王五', deadline: '2024-10-24', status: '已完成' },
  { id: 'T004', order: '某某家园1-2-202', task: '表面处理', assignee: '赵六', deadline: '2024-10-23', status: '逾期' },
];

const statusColors: Record<string, string> = {
  '待分配': 'bg-orange-100 text-orange-700',
  '进行中': 'bg-blue-100 text-blue-700',
  '已完成': 'bg-green-100 text-green-700',
  '逾期': 'bg-red-100 text-red-700',
};

export default function TasksPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">任务分配</h1>
            <p className="text-muted-foreground mt-1">管理生产任务分配和跟踪</p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {taskStats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-12 rounded-full ${stat.color}`} />
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Task List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>任务列表</CardTitle>
                <Button>新建任务</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">任务编号</th>
                      <th className="text-left py-3 px-4 font-medium">订单名称</th>
                      <th className="text-left py-3 px-4 font-medium">任务内容</th>
                      <th className="text-left py-3 px-4 font-medium">负责人</th>
                      <th className="text-left py-3 px-4 font-medium">截止日期</th>
                      <th className="text-left py-3 px-4 font-medium">状态</th>
                      <th className="text-left py-3 px-4 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-mono text-sm">{task.id}</td>
                        <td className="py-3 px-4">{task.order}</td>
                        <td className="py-3 px-4">{task.task}</td>
                        <td className="py-3 px-4">{task.assignee}</td>
                        <td className="py-3 px-4 text-muted-foreground">{task.deadline}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">查看</Button>
                            <Button variant="outline" size="sm">编辑</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
