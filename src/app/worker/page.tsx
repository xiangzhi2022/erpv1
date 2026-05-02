"use client";

import { useState, useEffect } from "react";
import {
  Package,
  CheckCircle,
  Clock,
  ScanLine,
  ChevronRight,
  LogOut,
  User,
} from "lucide-react";
import Link from "next/link";

interface Task {
  id: string;
  task_no: string;
  order_no: string;
  station: string;
  progress: string;
  barcode: string;
  product_name: string;
  quantity: number;
}

const stationColors: Record<string, string> = {
  "开料": "from-amber-500 to-orange-600",
  "封边": "from-blue-500 to-cyan-600",
  "打孔": "from-purple-500 to-pink-600",
  "包装": "from-emerald-500 to-green-600",
  "质检": "from-indigo-500 to-blue-600",
};

const progressLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "待开始", color: "text-slate-600 bg-slate-100" },
  processing: { label: "进行中", color: "text-blue-600 bg-blue-50" },
  completed: { label: "已完成", color: "text-emerald-600 bg-emerald-50" },
};

export default function WorkerDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"todo" | "done">("todo");
  const [user, setUser] = useState<{ nickname: string; position: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksRes, profileRes] = await Promise.all([
        fetch("/api/worker/tasks"),
        fetch("/api/auth/profile"),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }

      if (profileRes.ok) {
        const data = await profileRes.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async (taskId: string, action: "start" | "complete") => {
    try {
      const res = await fetch("/api/worker/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, action }),
      });

      if (res.ok) {
        fetchData(); // 刷新数据
      }
    } catch (error) {
      console.error("报工失败:", error);
    }
  };

  const todoTasks = tasks.filter(t => t.progress !== "completed");
  const doneTasks = tasks.filter(t => t.progress === "completed");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* 顶部导航 */}
      <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">{user?.nickname || "工人"}</p>
              <p className="text-xs text-slate-400">{user?.position || "生产工人"}</p>
            </div>
          </div>
          <Link
            href="/login"
            className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-600 transition-colors"
          >
            <LogOut className="w-5 h-5 text-slate-400" />
          </Link>
        </div>
      </header>

      {/* 扫码入口 */}
      <div className="p-6 max-w-2xl mx-auto">
        <button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-2xl p-6 flex items-center justify-center gap-4 transition-all shadow-lg shadow-blue-500/20">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <ScanLine className="w-8 h-8" />
          </div>
          <div className="text-left">
            <p className="text-xl font-bold">扫码报工</p>
            <p className="text-blue-100 text-sm">扫描板材条码快速登记</p>
          </div>
          <ChevronRight className="w-6 h-6 ml-auto" />
        </button>
      </div>

      {/* Tab切换 */}
      <div className="px-6 max-w-2xl mx-auto">
        <div className="flex bg-slate-800/50 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("todo")}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              activeTab === "todo"
                ? "bg-blue-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              待完成 ({todoTasks.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab("done")}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              activeTab === "done"
                ? "bg-emerald-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              已完成 ({doneTasks.length})
            </span>
          </button>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400">加载中...</div>
        ) : (activeTab === "todo" ? todoTasks : doneTasks).length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>{activeTab === "todo" ? "暂无待完成任务" : "暂无已完成任务"}</p>
          </div>
        ) : (
          (activeTab === "todo" ? todoTasks : doneTasks).map((task) => (
            <div
              key={task.id}
              className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden"
            >
              {/* 工序标签 */}
              <div className={`bg-gradient-to-r ${stationColors[task.station] || "from-gray-500 to-gray-600"} px-4 py-2`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{task.station}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${progressLabels[task.progress]?.color}`}>
                    {progressLabels[task.progress]?.label}
                  </span>
                </div>
              </div>

              {/* 任务内容 */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">{task.product_name}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      订单: {task.order_no} · 数量: {task.quantity}
                    </p>
                    {task.barcode && (
                      <p className="text-xs text-slate-500 mt-1 font-mono">
                        条码: {task.barcode}
                      </p>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                {task.progress !== "completed" && (
                  <div className="flex gap-3 mt-4">
                    {task.progress === "pending" && (
                      <button
                        onClick={() => handleReport(task.id, "start")}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-3 font-medium transition-colors"
                      >
                        开始任务
                      </button>
                    )}
                    {task.progress === "processing" && (
                      <button
                        onClick={() => handleReport(task.id, "complete")}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3 font-medium transition-colors"
                      >
                        完成任务
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部安全区 */}
      <div className="h-8" />
    </div>
  );
}
