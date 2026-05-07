"use client";

import { useState, useOptimistic, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { FactoryList } from "./components/factory-list";
import { FactoryToolbar } from "./components/factory-toolbar";
import { FactoryFormModal } from "./components/factory-form";
import { CreateFactoryButton } from "./components/create-button";
import { Workshop, WorkshopStats, WorkshopFormValues, WorkshopStatusType, statusConfig } from "./schemas";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Factory, Wrench, Ban, Activity } from "lucide-react";

function StatsCards({ stats }: { stats: WorkshopStats }) {
  const overallLoad =
    stats.totalCapacity > 0
      ? Math.round((stats.totalLoad / stats.totalCapacity) * 100)
      : 0;

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Factory className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">车间总数</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Activity className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">正常运行</p>
            <p className="text-2xl font-bold text-emerald-600">
              {stats.normal}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Wrench className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">检修中</p>
            <p className="text-2xl font-bold text-amber-600">
              {stats.maintenance}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Ban className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">停工</p>
            <p className="text-2xl font-bold text-red-600">{stats.stopped}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WorkshopManagementPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [stats, setStats] = useState<WorkshopStats>({
    total: 0,
    normal: 0,
    maintenance: 0,
    stopped: 0,
    totalCapacity: 0,
    totalLoad: 0,
  });
  const [loading, setLoading] = useState(true);

  // 搜索 & 过滤
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // 弹窗状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);

  // 乐观更新
  const [optimisticWorkshops, addOptimisticUpdate] = useOptimistic<
    Workshop[],
    { id: string; updates: Partial<Workshop> }
  >(workshops, (state, { id, updates }) => {
    return state.map((w) => (w.id === id ? { ...w, ...updates } : w));
  });

  // 获取数据
  const fetchWorkshops = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (keyword) {
        params.set("keyword", keyword);
      }

      const res = await fetch(`/api/factory/workshops?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWorkshops(data.workshops || []);
        setStats(data.stats || { total: 0, normal: 0, maintenance: 0, stopped: 0, totalCapacity: 0, totalLoad: 0 });
      }
    } catch (error) {
      console.error("获取车间列表失败:", error);
      toast.error("获取车间列表失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, keyword]);

  useEffect(() => {
    fetchWorkshops();
  }, [fetchWorkshops]);

  // 新增车间
  const handleCreate = async (values: WorkshopFormValues) => {
    try {
      const res = await fetch("/api/factory/workshops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "创建失败");
        return;
      }

      toast.success("车间创建成功");
      await fetchWorkshops();
    } catch (error) {
      console.error("创建车间失败:", error);
      toast.error("创建车间失败");
    }
  };

  // 编辑车间
  const handleEdit = async (values: WorkshopFormValues) => {
    if (!editingWorkshop) return;

    try {
      const res = await fetch(
        `/api/factory/workshops/${editingWorkshop.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "更新失败");
        return;
      }

      toast.success("车间信息已更新");
      setEditingWorkshop(null);
      await fetchWorkshops();
    } catch (error) {
      console.error("更新车间失败:", error);
      toast.error("更新车间失败");
    }
  };

  // 删除车间
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/factory/workshops/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "删除失败");
        return;
      }

      toast.success("车间已删除");
      await fetchWorkshops();
    } catch (error) {
      console.error("删除车间失败:", error);
      toast.error("删除车间失败");
    }
  };

  // 状态切换（乐观更新）
  const handleStatusChange = async (id: string, newStatus: WorkshopStatusType) => {
    // 乐观更新：立即反映UI变化
    addOptimisticUpdate({
      id,
      updates: {
        status: newStatus,
      },
    });

    try {
      const res = await fetch(`/api/factory/workshops/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || "状态变更失败");
        // 回滚：重新获取数据
        await fetchWorkshops();
        return;
      }

      toast.success(
        `车间状态已变更为「${statusConfig[newStatus].label}」`
      );
      await fetchWorkshops();
    } catch (error) {
      console.error("状态变更失败:", error);
      toast.error("状态变更失败");
      await fetchWorkshops();
    }
  };

  const displayWorkshops = optimisticWorkshops;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64">
        <div className="p-6 space-y-6">
          {/* 页面标题 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">车间管理</h1>
              <p className="text-muted-foreground mt-1">
                管理旗下工厂车间及产能状态，实时监控运行情况。
              </p>
            </div>
            <CreateFactoryButton
              onClick={() => {
                setEditingWorkshop(null);
                setFormOpen(true);
              }}
            />
          </div>

          {/* 统计卡片 */}
          <StatsCards stats={stats} />

          {/* 工具栏 */}
          <FactoryToolbar
            keyword={keyword}
            onKeywordChange={setKeyword}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            totalCount={stats.total}
            normalCount={stats.normal}
            maintenanceCount={stats.maintenance}
            stoppedCount={stats.stopped}
          />

          {/* 列表 */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg" />
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-24" />
                        <div className="h-3 bg-muted rounded w-16" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-3 bg-muted rounded" />
                    <div className="h-2 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <FactoryList
              workshops={displayWorkshops}
              stats={stats}
              viewMode={viewMode}
              onEdit={(workshop) => {
                setEditingWorkshop(workshop);
                setFormOpen(true);
              }}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          )}

          {/* 表单弹窗 */}
          <FactoryFormModal
            open={formOpen}
            onOpenChange={setFormOpen}
            workshop={editingWorkshop}
            onSubmit={editingWorkshop ? handleEdit : handleCreate}
          />
        </div>
      </main>
    </div>
  );
}
