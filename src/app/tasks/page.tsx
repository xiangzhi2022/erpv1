'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Plus, Eye, Pencil, RotateCcw } from 'lucide-react';

interface Task {
  id: string;
  task_no: string;
  order_no: string;
  station: string;
  progress: string;
  product_name?: string;
  quantity?: number;
  assignee?: string;
  deadline?: string;
}

interface Order {
  id: string;
  order_no: string;
  status: string;
  customer_name: string;
}

const progressConfig: Record<string, { label: string; color: string }> = {
  pending: { label: '待分配', color: 'bg-orange-100 text-orange-700' },
  processing: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchOrder, setSearchOrder] = useState('');
  const [searchAssignee, setSearchAssignee] = useState('');

  // 新建任务弹窗
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({ order_id: '', station: '', assignee: '', deadline: '' });
  const [createLoading, setCreateLoading] = useState(false);

  // 查看详情弹窗
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // 编辑弹窗
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ station: '', assignee: '', deadline: '', progress: '' });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, ordersRes] = await Promise.all([
        fetch('/api/worker/tasks').catch(() => null),
        fetch('/api/orders').catch(() => null),
      ]);

      if (tasksRes?.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }

      if (ordersRes?.ok) {
        const data = await ordersRes.json();
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const taskStats = [
    { label: '待分配任务', value: tasks.filter(t => t.progress === 'pending').length, color: 'bg-orange-500' },
    { label: '进行中任务', value: tasks.filter(t => t.progress === 'processing').length, color: 'bg-blue-500' },
    { label: '已完成任务', value: tasks.filter(t => t.progress === 'completed').length, color: 'bg-green-500' },
    { label: '全部任务', value: tasks.length, color: 'bg-gray-500' },
  ];

  const filteredTasks = tasks
    .filter(t => {
      if (activeTab === 'pending') return t.progress === 'pending';
      if (activeTab === 'processing') return t.progress === 'processing';
      if (activeTab === 'completed') return t.progress === 'completed';
      return true;
    })
    .filter(t => {
      if (searchOrder.trim() && !t.order_no?.includes(searchOrder.trim())) return false;
      if (searchAssignee.trim() && !t.assignee?.includes(searchAssignee.trim())) return false;
      return true;
    });

  const handleCreateTask = async () => {
    if (!newTask.order_id || !newTask.station) return;
    setCreateLoading(true);
    try {
      const res = await fetch('/api/worker/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const data = await res.json();
      if (data.success) {
        setCreateDialogOpen(false);
        setNewTask({ order_id: '', station: '', assignee: '', deadline: '' });
        fetchData();
      } else {
        alert(data.error || '创建失败');
      }
    } catch {
      alert('创建任务失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditTask = async () => {
    if (!editTask) return;
    setEditLoading(true);
    try {
      const res = await fetch('/api/worker/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTask.id, ...editForm }),
      });
      const data = await res.json();
      if (data.success) {
        setEditDialogOpen(false);
        setEditTask(null);
        fetchData();
      } else {
        alert(data.error || '更新失败');
      }
    } catch {
      alert('更新任务失败');
    } finally {
      setEditLoading(false);
    }
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setEditForm({
      station: task.station || '',
      assignee: task.assignee || '',
      deadline: task.deadline || '',
      progress: task.progress || 'pending',
    });
    setEditDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">任务分配</h1>
              <p className="text-muted-foreground mt-1">管理生产任务分配和跟踪</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchData}>刷新</Button>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> 新建任务
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))
            ) : (
              taskStats.map((stat) => (
                <Card
                  key={stat.label}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    if (stat.label === '待分配任务') setActiveTab('pending');
                    else if (stat.label === '进行中任务') setActiveTab('processing');
                    else if (stat.label === '已完成任务') setActiveTab('completed');
                    else setActiveTab('all');
                  }}
                >
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
              ))
            )}
          </div>

          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>订单编号</Label>
                  <Input
                    placeholder="请输入订单编号"
                    value={searchOrder}
                    onChange={(e) => setSearchOrder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>负责人</Label>
                  <Input
                    placeholder="请输入负责人"
                    value={searchAssignee}
                    onChange={(e) => setSearchAssignee(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button variant="outline" onClick={() => { setSearchOrder(''); setSearchAssignee(''); }}>
                    <RotateCcw className="h-4 w-4 mr-1" /> 重置
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>任务列表</CardTitle>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="all">全部</TabsTrigger>
                    <TabsTrigger value="pending">待分配</TabsTrigger>
                    <TabsTrigger value="processing">进行中</TabsTrigger>
                    <TabsTrigger value="completed">已完成</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无任务数据</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">任务编号</th>
                        <th className="text-left py-3 px-4 font-medium">订单名称</th>
                        <th className="text-left py-3 px-4 font-medium">工序</th>
                        <th className="text-left py-3 px-4 font-medium">负责人</th>
                        <th className="text-left py-3 px-4 font-medium">截止日期</th>
                        <th className="text-left py-3 px-4 font-medium">状态</th>
                        <th className="text-left py-3 px-4 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const cfg = progressConfig[task.progress] || { label: task.progress, color: 'bg-gray-100 text-gray-700' };
                        return (
                          <tr key={task.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 font-mono text-sm">{task.task_no || task.id.slice(0, 8)}</td>
                            <td className="py-3 px-4">{task.order_no || task.product_name || '-'}</td>
                            <td className="py-3 px-4">{task.station || '-'}</td>
                            <td className="py-3 px-4">{task.assignee || '-'}</td>
                            <td className="py-3 px-4 text-muted-foreground">{task.deadline || '-'}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setSelectedTask(task); setDetailOpen(true); }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEdit(task)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>任务详情</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-muted-foreground">任务编号</Label><p className="font-mono">{selectedTask.task_no || selectedTask.id.slice(0, 8)}</p></div>
                <div><Label className="text-muted-foreground">状态</Label><p><Badge variant="outline">{(progressConfig[selectedTask.progress] || { label: selectedTask.progress }).label}</Badge></p></div>
                <div><Label className="text-muted-foreground">订单编号</Label><p>{selectedTask.order_no || '-'}</p></div>
                <div><Label className="text-muted-foreground">工序</Label><p>{selectedTask.station || '-'}</p></div>
                <div><Label className="text-muted-foreground">负责人</Label><p>{selectedTask.assignee || '-'}</p></div>
                <div><Label className="text-muted-foreground">截止日期</Label><p>{selectedTask.deadline || '-'}</p></div>
              </div>
              {selectedTask.product_name && (
                <div><Label className="text-muted-foreground">产品名称</Label><p>{selectedTask.product_name}</p></div>
              )}
              {selectedTask.quantity && (
                <div><Label className="text-muted-foreground">数量</Label><p>{selectedTask.quantity}</p></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑任务</DialogTitle>
            <DialogDescription>修改任务信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>工序</Label>
              <Select value={editForm.station} onValueChange={(v) => setEditForm(prev => ({ ...prev, station: v }))}>
                <SelectTrigger><SelectValue placeholder="请选择工序" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="开料">开料</SelectItem>
                  <SelectItem value="封边">封边</SelectItem>
                  <SelectItem value="打孔">打孔</SelectItem>
                  <SelectItem value="包装">包装</SelectItem>
                  <SelectItem value="质检">质检</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>负责人</Label>
              <Input
                placeholder="请输入负责人"
                value={editForm.assignee}
                onChange={(e) => setEditForm(prev => ({ ...prev, assignee: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>截止日期</Label>
              <Input
                type="date"
                value={editForm.deadline}
                onChange={(e) => setEditForm(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>进度</Label>
              <Select value={editForm.progress} onValueChange={(v) => setEditForm(prev => ({ ...prev, progress: v }))}>
                <SelectTrigger><SelectValue placeholder="请选择进度" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待分配</SelectItem>
                  <SelectItem value="processing">进行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleEditTask} disabled={editLoading}>
              {editLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建任务</DialogTitle>
            <DialogDescription>为订单创建生产任务</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>关联订单</Label>
              <Select value={newTask.order_id} onValueChange={(v) => setNewTask(prev => ({ ...prev, order_id: v }))}>
                <SelectTrigger><SelectValue placeholder="请选择订单" /></SelectTrigger>
                <SelectContent>
                  {orders.filter(o => !['pending', 'returned', 'cancelled'].includes(o.status)).map(order => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_no} - {order.customer_name || '未知客户'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>工序</Label>
              <Select value={newTask.station} onValueChange={(v) => setNewTask(prev => ({ ...prev, station: v }))}>
                <SelectTrigger><SelectValue placeholder="请选择工序" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="开料">开料</SelectItem>
                  <SelectItem value="封边">封边</SelectItem>
                  <SelectItem value="打孔">打孔</SelectItem>
                  <SelectItem value="包装">包装</SelectItem>
                  <SelectItem value="质检">质检</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>负责人</Label>
              <Input
                placeholder="请输入负责人"
                value={newTask.assignee}
                onChange={(e) => setNewTask(prev => ({ ...prev, assignee: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>截止日期</Label>
              <Input
                type="date"
                value={newTask.deadline}
                onChange={(e) => setNewTask(prev => ({ ...prev, deadline: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateTask} disabled={createLoading || !newTask.order_id || !newTask.station}>
              {createLoading ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
