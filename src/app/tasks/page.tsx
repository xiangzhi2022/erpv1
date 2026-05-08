"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LayoutList,
  Kanban,
  Plus,
  Search,
  GripVertical,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  User,
  CalendarDays,
  Flag,
  Bell,
  BellRing,
  X,
  Trash2,
  Pencil,
  Eye,
  ChevronRight,
  Filter,
} from "lucide-react";
import type { Task, Category } from "@/db/schema";

interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  in_progress: number;
  overdue: number;
}

interface NotificationItem {
  id: string;
  task_id: string | null;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "待办", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Circle },
  in_progress: { label: "进行中", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock },
  completed: { label: "已完成", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
};

const priorityConfig: Record<number, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  0: { label: "普通", color: "text-gray-500", icon: Flag },
  1: { label: "重要", color: "text-blue-500", icon: Flag },
  2: { label: "紧急", color: "text-orange-500", icon: Flag },
  3: { label: "最高", color: "text-red-500", icon: Flag },
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  // Sheet for task creation/editing
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "pending" as string,
    priority: 0,
    category_id: "none" as string,
    assignee_name: "",
    due_date: "",
  });

  // Detail dialog
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Notification popover
  const [notifOpen, setNotifOpen] = useState(false);

  // Drag state
  const dragItem = useRef<Task | null>(null);
  const dragOverColumn = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, catRes, notifRes] = await Promise.all([
        fetch("/api/tasks").catch(() => null),
        fetch("/api/categories").catch(() => null),
        fetch("/api/notifications").catch(() => null),
      ]);

      if (tasksRes?.ok) {
        const data = await tasksRes.json();
        setTasks(data.data || []);
        setStats(data.stats || null);
      }

      if (catRes?.ok) {
        const data = await catRes.json();
        setCategories(data.data || []);
      }

      if (notifRes?.ok) {
        const data = await notifRes.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== Number(filterPriority)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.assignee_name && t.assignee_name.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Group tasks by status for kanban view
  const kanbanColumns: { status: string; label: string; color: string }[] = [
    { status: "pending", label: "待办", color: "border-t-yellow-400" },
    { status: "in_progress", label: "进行中", color: "border-t-blue-400" },
    { status: "completed", label: "已完成", color: "border-t-green-400" },
  ];

  // Drag handlers
  const handleDragStart = (task: Task) => {
    dragItem.current = task;
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    dragOverColumn.current = status;
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const task = dragItem.current;
    if (!task || task.status === targetStatus) return;

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          completed: targetStatus === "completed",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: targetStatus, completed: targetStatus === "completed" } : t))
        );
      }
    } catch {
      // Silent fail
    }
    dragItem.current = null;
    dragOverColumn.current = null;
  };

  // Form handlers
  const openCreate = () => {
    setEditingTask(null);
    setForm({
      title: "",
      description: "",
      status: "pending",
      priority: 0,
      category_id: "none",
      assignee_name: "",
      due_date: "",
    });
    setFormError(null);
    setSheetOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      category_id: task.category_id ?? "none",
      assignee_name: task.assignee_name ?? "",
      due_date: task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "",
    });
    setFormError(null);
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setFormError("任务标题不能为空");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        category_id: form.category_id === "none" ? undefined : form.category_id,
        assignee_name: form.assignee_name.trim() || undefined,
        due_date: form.due_date || undefined,
      };

      if (editingTask) {
        const res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "更新失败");
        setTasks((prev) =>
          prev.map((t) => (t.id === editingTask.id ? data.data : t))
        );
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "创建失败");
        setTasks((prev) => [data.data, ...prev]);
      }
      setSheetOpen(false);
      fetchData();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggle = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? data.data : t)));
      }
    } catch {
      // Silent fail
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除该任务？")) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // Silent fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  };

  const handleCheckOverdue = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkOverdue" }),
      });
      fetchData();
    } catch {
      // Silent fail
    }
  };

  const getCategoryName = (id: string | null): string => {
    if (!id) return "";
    return categories.find((c) => c.id === id)?.name ?? "";
  };

  const getCategoryColor = (id: string | null): string => {
    if (!id) return "#6366f1";
    return categories.find((c) => c.id === id)?.color ?? "#6366f1";
  };

  const isOverdue = (task: Task): boolean => {
    if (!task.due_date || task.status === "completed") return false;
    return new Date(task.due_date) < new Date();
  };

  const isDueSoon = (task: Task): boolean => {
    if (!task.due_date || task.status === "completed") return false;
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const dueDate = new Date(task.due_date);
    return dueDate <= threeDaysLater && dueDate >= new Date();
  };

  const formatDate = (dateVal: string | Date | null): string => {
    if (!dateVal) return "";
    return new Date(dateVal).toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  };

  // Task card component (shared between kanban and list views)
  const TaskCard = ({ task, compact = false }: { task: Task; compact?: boolean }) => {
    const overdue = isOverdue(task);
    const dueSoon = isDueSoon(task);
    const pCfg = priorityConfig[task.priority] || priorityConfig[0];
    const PriorityIcon = pCfg.icon;

    return (
      <Card
        draggable={viewMode === "kanban"}
        onDragStart={() => handleDragStart(task)}
        className={`group cursor-pointer transition-all hover:shadow-md ${
          task.completed ? "opacity-60" : ""
        } ${overdue ? "border-red-200 bg-red-50/30" : ""} ${
          compact ? "py-2" : ""
        }`}
        onClick={() => {
          setDetailTask(task);
          setDetailOpen(true);
        }}
      >
        <CardContent className={`${compact ? "px-3 py-2" : "px-4 py-3"}`}>
          <div className="flex items-start gap-2">
            {viewMode === "kanban" && (
              <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground/50 shrink-0 cursor-grab" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(task);
                  }}
                  className="shrink-0 hover:scale-110 transition-transform"
                >
                  {task.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <span
                  className={`font-medium text-sm ${
                    task.completed ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {task.title}
                </span>
              </div>

              {!compact && task.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {task.priority > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <PriorityIcon className={`h-3.5 w-3.5 ${pCfg.color}`} />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{pCfg.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {task.category_id && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5"
                    style={{
                      borderColor: getCategoryColor(task.category_id),
                      color: getCategoryColor(task.category_id),
                    }}
                  >
                    {getCategoryName(task.category_id)}
                  </Badge>
                )}

                {task.assignee_name && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    {task.assignee_name}
                  </span>
                )}

                {task.due_date && (
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      overdue
                        ? "text-red-500 font-medium"
                        : dueSoon
                        ? "text-orange-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {overdue ? (
                      <AlertTriangle className="h-3 w-3" />
                    ) : (
                      <CalendarDays className="h-3 w-3" />
                    )}
                    {formatDate(task.due_date)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(task);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(task.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="border-b px-6 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">任务管理</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  任务协作与进度跟踪
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Notification Bell */}
                <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="relative">
                      {unreadCount > 0 ? (
                        <BellRing className="h-4 w-4" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <span className="font-medium text-sm">通知</span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleCheckOverdue}
                        >
                          检查过期
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={handleMarkAllRead}
                        >
                          全部已读
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-72">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          暂无通知
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer ${
                              !n.read ? "bg-blue-50/50" : ""
                            }`}
                            onClick={async () => {
                              if (!n.read) {
                                try {
                                  await fetch(`/api/notifications/${n.id}`, {
                                    method: "PATCH",
                                  });
                                  setNotifications((prev) =>
                                    prev.map((item) =>
                                      item.id === n.id
                                        ? { ...item, read: true }
                                        : item
                                    )
                                  );
                                  setUnreadCount((c) => Math.max(0, c - 1));
                                } catch {
                                  // Silent fail
                                }
                              }
                            }}
                          >
                            <div className="flex items-start gap-2">
                              {!n.read && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {n.title}
                                </p>
                                {n.message && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {n.message}
                                  </p>
                                )}
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {new Date(n.created_at).toLocaleString("zh-CN")}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  新建任务
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="px-6 pt-4">
            <div className="grid grid-cols-5 gap-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 pb-3">
                      <Skeleton className="h-8 w-12 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                <>
                  <Card
                    className={`cursor-pointer hover:shadow-sm transition-shadow ${
                      filterStatus === "all" ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setFilterStatus("all")}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full bg-gray-400" />
                        <div>
                          <p className="text-xl font-bold">{stats?.total ?? 0}</p>
                          <p className="text-xs text-muted-foreground">全部任务</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className={`cursor-pointer hover:shadow-sm transition-shadow ${
                      filterStatus === "pending" ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setFilterStatus(filterStatus === "pending" ? "all" : "pending")}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full bg-yellow-400" />
                        <div>
                          <p className="text-xl font-bold">{stats?.pending ?? 0}</p>
                          <p className="text-xs text-muted-foreground">待办</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className={`cursor-pointer hover:shadow-sm transition-shadow ${
                      filterStatus === "in_progress" ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setFilterStatus(filterStatus === "in_progress" ? "all" : "in_progress")}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full bg-blue-400" />
                        <div>
                          <p className="text-xl font-bold">{stats?.in_progress ?? 0}</p>
                          <p className="text-xs text-muted-foreground">进行中</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className={`cursor-pointer hover:shadow-sm transition-shadow ${
                      filterStatus === "completed" ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setFilterStatus(filterStatus === "completed" ? "all" : "completed")}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full bg-green-400" />
                        <div>
                          <p className="text-xl font-bold">{stats?.completed ?? 0}</p>
                          <p className="text-xs text-muted-foreground">已完成</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card
                    className="cursor-pointer hover:shadow-sm transition-shadow"
                    onClick={handleCheckOverdue}
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 rounded-full bg-red-400" />
                        <div>
                          <p className="text-xl font-bold">{stats?.overdue ?? 0}</p>
                          <p className="text-xs text-muted-foreground">已过期</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>

          {/* Toolbar: Search + Filters + View Toggle */}
          <div className="px-6 pt-4 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索任务名称、负责人..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-28">
                <Flag className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="优先级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部优先级</SelectItem>
                <SelectItem value="0">P0 普通</SelectItem>
                <SelectItem value="1">P1 重要</SelectItem>
                <SelectItem value="2">P2 紧急</SelectItem>
                <SelectItem value="3">P3 最高</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode("kanban")}
              >
                <Kanban className="h-4 w-4 mr-1" />
                看板
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode("list")}
              >
                <LayoutList className="h-4 w-4 mr-1" />
                列表
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto px-6 pt-4 pb-6">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Circle className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">暂无任务</p>
                <p className="text-sm mt-1">点击"新建任务"开始创建</p>
              </div>
            ) : viewMode === "kanban" ? (
              /* Kanban View */
              <div className="grid grid-cols-3 gap-4 h-full">
                {kanbanColumns.map((col) => {
                  const colTasks = filteredTasks.filter(
                    (t) => t.status === col.status
                  );
                  return (
                    <div
                      key={col.status}
                      className={`flex flex-col rounded-lg border bg-muted/20 ${col.color} border-t-4`}
                      onDragOver={(e) => handleDragOver(e, col.status)}
                      onDrop={(e) => handleDrop(e, col.status)}
                    >
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {col.label}
                          </span>
                          <Badge variant="secondary" className="text-xs h-5 px-1.5">
                            {colTasks.length}
                          </Badge>
                        </div>
                      </div>
                      <ScrollArea className="flex-1 px-2 pb-2">
                        <div className="space-y-2">
                          {colTasks.map((task) => (
                            <TaskCard key={task.id} task={task} compact />
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-4 font-medium text-xs text-muted-foreground w-8"></th>
                        <th className="text-left py-3 px-4 font-medium text-xs text-muted-foreground">任务标题</th>
                        <th className="text-left py-3 px-4 font-medium text-xs text-muted-foreground">状态</th>
                        <th className="text-left py-3 px-4 font-medium text-xs text-muted-foreground">优先级</th>
                        <th className="text-left py-3 px-4 font-medium text-xs text-muted-foreground">分类</th>
                        <th className="text-left py-3 px-4 font-medium text-xs text-muted-foreground">负责人</th>
                        <th className="text-left py-3 px-4 font-medium text-xs text-muted-foreground">截止日期</th>
                        <th className="text-left py-3 px-4 font-medium text-xs text-muted-foreground w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const sCfg = statusConfig[task.status] || statusConfig.pending;
                        const pCfg = priorityConfig[task.priority] || priorityConfig[0];
                        const PriorityIcon = pCfg.icon;
                        const overdue = isOverdue(task);

                        return (
                          <tr
                            key={task.id}
                            className={`border-b hover:bg-muted/50 transition-colors ${
                              task.completed ? "opacity-60" : ""
                            }`}
                          >
                            <td className="py-3 px-4">
                              <button onClick={() => handleToggle(task)}>
                                {task.completed ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Circle className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                            </td>
                            <td className="py-3 px-4">
                              <div className="max-w-xs">
                                <span
                                  className={`text-sm font-medium ${
                                    task.completed
                                      ? "line-through text-muted-foreground"
                                      : ""
                                  }`}
                                >
                                  {task.title}
                                </span>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant="secondary"
                                className={`text-xs ${sCfg.color}`}
                              >
                                {sCfg.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <PriorityIcon
                                  className={`h-3.5 w-3.5 ${pCfg.color}`}
                                />
                                <span className="text-xs">{pCfg.label}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {task.category_id ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs h-5"
                                  style={{
                                    borderColor: getCategoryColor(task.category_id),
                                    color: getCategoryColor(task.category_id),
                                  }}
                                >
                                  {getCategoryName(task.category_id)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {task.assignee_name ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="text-[10px] font-medium text-primary">
                                      {task.assignee_name.charAt(0)}
                                    </span>
                                  </div>
                                  <span className="text-xs">{task.assignee_name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">未分配</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {task.due_date ? (
                                <span
                                  className={`text-xs flex items-center gap-1 ${
                                    overdue
                                      ? "text-red-500 font-medium"
                                      : isDueSoon(task)
                                      ? "text-orange-500"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {overdue && <AlertTriangle className="h-3 w-3" />}
                                  {formatDate(task.due_date)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setDetailTask(task);
                                    setDetailOpen(true);
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEdit(task)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDelete(task.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Task Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editingTask ? "编辑任务" : "新建任务"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">标题 *</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="输入任务标题"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">描述</Label>
              <Textarea
                id="task-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="任务详细描述（可选）"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>状态</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待办</SelectItem>
                    <SelectItem value="in_progress">进行中</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select
                  value={String(form.priority)}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, priority: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">P0 - 普通</SelectItem>
                    <SelectItem value="1">P1 - 重要</SelectItem>
                    <SelectItem value="2">P2 - 紧急</SelectItem>
                    <SelectItem value="3">P3 - 最高</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>分类</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, category_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无分类</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>截止日期</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, due_date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>负责人</Label>
              <Input
                value={form.assignee_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, assignee_name: e.target.value }))
                }
                placeholder="输入负责人姓名"
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={formLoading}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={formLoading}>
              {formLoading
                ? "提交中..."
                : editingTask
                ? "更新"
                : "创建"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Task Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailTask?.title}
              {detailTask && (
                <Badge
                  variant="secondary"
                  className={`text-xs ${
                    statusConfig[detailTask.status]?.color || ""
                  }`}
                >
                  {statusConfig[detailTask.status]?.label || detailTask.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailTask && (
            <div className="space-y-4">
              {detailTask.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">描述</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">
                    {detailTask.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">优先级</Label>
                  <div className="flex items-center gap-1 mt-1">
                    {(() => {
                      const pCfg = priorityConfig[detailTask.priority] || priorityConfig[0];
                      const Icon = pCfg.icon;
                      return (
                        <>
                          <Icon className={`h-4 w-4 ${pCfg.color}`} />
                          <span className="text-sm">{pCfg.label}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">分类</Label>
                  <p className="text-sm mt-1">
                    {detailTask.category_id
                      ? getCategoryName(detailTask.category_id)
                      : "无分类"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">负责人</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {detailTask.assignee_name ? (
                      <>
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {detailTask.assignee_name.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm">{detailTask.assignee_name}</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">未分配</span>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">截止日期</Label>
                  <p className="text-sm mt-1 flex items-center gap-1">
                    {detailTask.due_date ? (
                      <>
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(detailTask.due_date).toLocaleDateString("zh-CN")}
                        {isOverdue(detailTask) && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1 ml-1">
                            已过期
                          </Badge>
                        )}
                      </>
                    ) : (
                      "未设置"
                    )}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  创建时间:{" "}
                  {new Date(detailTask.created_at).toLocaleString("zh-CN")}
                </div>
                <div>
                  更新时间:{" "}
                  {detailTask.updated_at
                    ? new Date(detailTask.updated_at).toLocaleString("zh-CN")
                    : "-"}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (detailTask) {
                  openEdit(detailTask);
                  setDetailOpen(false);
                }
              }}
            >
              <Pencil className="h-3 w-3 mr-1" />
              编辑
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailOpen(false)}
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
