"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package,
  CheckCircle,
  Clock,
  ScanLine,
  ChevronRight,
  LogOut,
  User,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

/** 与后端 /api/worker/tasks 返回的 WorkerTaskResponse 对齐 */
interface Task {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  completed: number;
  status: "pending" | "processing" | "completed";
  workshop_id: string | null;
  order_no: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface TaskStats {
  pending: number;
  processing: number;
  completed: number;
  total: number;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "待开始", color: "text-slate-600 bg-slate-100" },
  processing: { label: "进行中", color: "text-blue-600 bg-blue-50" },
  completed: { label: "已完成", color: "text-emerald-600 bg-emerald-50" },
};

export default function WorkerDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"todo" | "done">("todo");
  const [user, setUser] = useState<{ nickname: string; position: string } | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const [tasksRes, profileRes] = await Promise.all([
        fetch("/api/worker/tasks"),
        fetch("/api/auth/profile").catch(() => null),
      ]);

      if (tasksRes?.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
        setStats(data.stats || null);
      }

      if (profileRes?.ok) {
        const data = await profileRes.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("获取数据失败:", error);
      setErrorMsg("获取数据失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReport = async (taskId: string, action: "start" | "complete") => {
    if (reporting) return; // 防重复点击
    setReporting(taskId);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/worker/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, action }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await fetchData();
      } else {
        setErrorMsg(data.error || "操作失败");
      }
    } catch (error) {
      console.error("报工失败:", error);
      setErrorMsg("网络异常，请重试");
    } finally {
      setReporting(null);
    }
  };

  const todoTasks = tasks.filter((t) => t.status !== "completed");
  const doneTasks = tasks.filter((t) => t.status === "completed");

  const displayTasks = activeTab === "todo" ? todoTasks : doneTasks;

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

      {/* 统计卡片 */}
      {stats && (
        <div className="px-6 pt-4 max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-slate-300">{stats.pending}</p>
              <p className="text-xs text-slate-500">待开始</p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.processing}</p>
              <p className="text-xs text-slate-500">进行中</p>
            </div>
            <div className="bg-slate-800/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
              <p className="text-xs text-slate-500">已完成</p>
            </div>
          </div>
        </div>
      )}

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

      {/* 错误提示 */}
      {errorMsg && (
        <div className="px-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="ml-auto text-red-500 hover:text-red-300"
            >
              &times;
            </button>
          </div>
        </div>
      )}

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
        ) : displayTasks.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>{activeTab === "todo" ? "暂无待完成任务" : "暂无已完成任务"}</p>
          </div>
        ) : (
          displayTasks.map((task) => (
            <div
              key={task.id}
              className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden"
            >
              {/* 状态标签栏 */}
              <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{task.order_no || "—"}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${statusLabels[task.status]?.color || "text-gray-400 bg-gray-800"}`}
                  >
                    {statusLabels[task.status]?.label || task.status}
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
                      订单: {task.order_no || "—"} · 数量: {task.completed}/{task.quantity}
                    </p>
                    {task.start_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        开始: {new Date(task.start_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                {task.status !== "completed" && (
                  <div className="flex gap-3 mt-4">
                    {task.status === "pending" && (
                      <button
                        onClick={() => handleReport(task.id, "start")}
                        disabled={reporting === task.id}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {reporting === task.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            处理中
                          </>
                        ) : (
                          "开始任务"
                        )}
                      </button>
                    )}
                    {task.status === "processing" && (
                      <button
                        onClick={() => handleReport(task.id, "complete")}
                        disabled={reporting === task.id}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {reporting === task.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            处理中
                          </>
                        ) : (
                          "完成任务"
                        )}
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
