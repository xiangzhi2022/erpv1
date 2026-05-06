"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import {
  Package,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  ClipboardList,
  Settings,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  total_amount: number;
  status: string;
  delivery_date: string;
  created_at: string;
}

interface Task {
  id: string;
  task_no: string;
  station: string;
  progress: string;
  order_no: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "待接收", color: "text-amber-600 bg-amber-50" },
  confirmed: { label: "已接收", color: "text-blue-600 bg-blue-50" },
  producing: { label: "生产中", color: "text-emerald-600 bg-emerald-50" },
  shipped: { label: "已发货", color: "text-purple-600 bg-purple-50" },
};

const taskProgressConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "未开始", color: "text-slate-600 bg-slate-100" },
  processing: { label: "进行中", color: "text-blue-600 bg-blue-50" },
  completed: { label: "已完成", color: "text-emerald-600 bg-emerald-50" },
};

export default function FactoryDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    producing: 0,
    totalTasks: 0,
    completedTasks: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, tasksRes] = await Promise.all([
        fetch("/api/factory/orders"),
        fetch("/api/factory/tasks"),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
        
        const statsData = {
          pending: data.orders?.filter((o: Order) => o.status === "pending").length || 0,
          producing: data.orders?.filter((o: Order) => o.status === "producing").length || 0,
          totalTasks: data.tasks?.length || 0,
          completedTasks: data.tasks?.filter((t: Task) => t.progress === "completed").length || 0,
        };
        setStats(statsData);
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => (price / 100).toFixed(2);
  const formatDate = (date: string) => new Date(date).toLocaleDateString("zh-CN");
  const progressPercent = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar />
      
      <main className="flex-1 p-8 ml-64">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">工厂管理后台</h1>
          <p className="text-slate-400 mt-2">生产调度看板，管理订单和工序</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">待接收订单</p>
                <p className="text-3xl font-bold text-amber-400 mt-2">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">生产中订单</p>
                <p className="text-3xl font-bold text-emerald-400 mt-2">{stats.producing}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">全部工序</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">{stats.totalTasks}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">完成进度</p>
                <p className="text-3xl font-bold text-white mt-2">{progressPercent}%</p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <Link
            href="/factory/orders"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl p-5 flex items-center gap-4 transition-all"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold">订单管理</h3>
              <p className="text-blue-100 text-sm">查看和处理订单</p>
            </div>
          </Link>
          
          <Link
            href="/factory/tasks"
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl p-5 flex items-center gap-4 transition-all"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold">工序调度</h3>
              <p className="text-emerald-100 text-sm">分配生产任务</p>
            </div>
          </Link>
          
          <Link
            href="/factory/workers"
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl p-5 flex items-center gap-4 transition-all"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold">工人管理</h3>
              <p className="text-purple-100 text-sm">管理车间工人</p>
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 待接收订单 */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              待接收订单
            </h2>
            {loading ? (
              <div className="text-center py-6 text-slate-400">加载中...</div>
            ) : orders.filter(o => o.status === "pending").length === 0 ? (
              <div className="text-center py-6 text-slate-400">暂无待接收订单</div>
            ) : (
              <div className="space-y-3">
                {orders.filter(o => o.status === "pending").slice(0, 4).map((order) => (
                  <div
                    key={order.id}
                    className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-white">{order.order_no}</p>
                        <p className="text-sm text-slate-400 mt-1">{order.customer_name}</p>
                      </div>
                      <span className="text-lg font-bold text-white">¥{formatPrice(order.total_amount)}</span>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs text-slate-500">交货: {formatDate(order.delivery_date)}</span>
                      <button className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded hover:bg-emerald-500/30">
                        接单
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 工序进度 */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-400" />
              工序进度
            </h2>
            {loading ? (
              <div className="text-center py-6 text-slate-400">加载中...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-6 text-slate-400">暂无进行中的工序</div>
            ) : (
              <div className="space-y-3">
                {tasks.filter(t => t.progress !== "completed").slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-white">{task.station}</p>
                        <p className="text-sm text-slate-400 mt-1">{task.order_no}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${taskProgressConfig[task.progress]?.color}`}>
                        {taskProgressConfig[task.progress]?.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
