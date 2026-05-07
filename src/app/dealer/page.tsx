"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import {
  Package,
  Plus,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  Building2,
  ArrowRight,
  Eye,
} from "lucide-react";
import Link from "next/link";

interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  total_amount: number;
  status: string;
  target_factory_id: string;
  delivery_date: string;
  created_at: string;
}

interface Factory {
  id: string;
  name: string;
  avg_completion_days: number;
  current_load: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "待审核", color: "text-amber-600 bg-amber-50", icon: <Clock className="w-4 h-4" /> },
  confirmed: { label: "已确认", color: "text-blue-600 bg-blue-50", icon: <CheckCircle className="w-4 h-4" /> },
  producing: { label: "生产中", color: "text-emerald-600 bg-emerald-50", icon: <Package className="w-4 h-4" /> },
  shipped: { label: "已发货", color: "text-purple-600 bg-purple-50", icon: <Truck className="w-4 h-4" /> },
  completed: { label: "已完成", color: "text-gray-600 bg-gray-50", icon: <CheckCircle className="w-4 h-4" /> },
  cancelled: { label: "已取消", color: "text-red-600 bg-red-50", icon: <AlertCircle className="w-4 h-4" /> },
};

export default function DealerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    producing: 0,
    shipped: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, factoriesRes] = await Promise.all([
        fetch("/api/dealer/orders"),
        fetch("/api/dealer/factories"),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
        
        // 计算统计
        const statsData = {
          total: data.orders?.length || 0,
          pending: data.orders?.filter((o: Order) => o.status === "pending").length || 0,
          producing: data.orders?.filter((o: Order) => o.status === "producing").length || 0,
          shipped: data.orders?.filter((o: Order) => o.status === "shipped").length || 0,
        };
        setStats(statsData);
      }

      if (factoriesRes.ok) {
        const data = await factoriesRes.json();
        setFactories(data.factories || []);
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return (price / 100).toFixed(2);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("zh-CN");
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar />
      
      <main className="flex-1 p-8 ml-64">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">经销商工作台</h1>
          <p className="text-slate-400 mt-2">管理订单，跟踪生产进度</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">全部订单</p>
                <p className="text-3xl font-bold text-white mt-2">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">待审核</p>
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
                <p className="text-slate-400 text-sm">生产中</p>
                <p className="text-3xl font-bold text-emerald-400 mt-2">{stats.producing}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">已发货</p>
                <p className="text-3xl font-bold text-purple-400 mt-2">{stats.shipped}</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Link
            href="/dealer/orders/new"
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl p-6 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <Plus className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold">创建新订单</h3>
                <p className="text-blue-100 mt-1">选择工厂，下单生产</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6" />
          </Link>
          
          <Link
            href="/dealer/factories"
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl p-6 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold">工厂管理</h3>
                <p className="text-emerald-100 mt-1">查看各工厂负载情况</p>
              </div>
            </div>
            <ArrowRight className="w-6 h-6" />
          </Link>
        </div>

        {/* 工厂列表 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">可选工厂</h2>
          <div className="grid grid-cols-4 gap-4">
            {factories.map((factory) => (
              <div
                key={factory.id}
                className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
              >
                <h3 className="font-semibold text-white">{factory.name}</h3>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">当前负载</span>
                    <span className="text-blue-400">{factory.current_load}单</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">预计周期</span>
                    <span className="text-emerald-400">{factory.avg_completion_days}天</span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-500 rounded-full h-2"
                      style={{ width: `${(factory.current_load / 100) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 订单列表 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">最近订单</h2>
            <Link
              href="/dealer/orders"
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loading ? (
            <div className="text-center py-8 text-slate-400">加载中...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              暂无订单，点击上方创建新订单
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => (
                <Link
                  key={order.id}
                  href={`/dealer/orders/${order.id}`}
                  className="block bg-slate-700/30 hover:bg-slate-700/50 rounded-lg p-4 border border-slate-600/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusConfig[order.status]?.color || ""}`}>
                        {statusConfig[order.status]?.icon || <Package className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{order.order_no}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {order.customer_name} · {formatDate(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">
                        ¥{formatPrice(order.total_amount)}
                      </p>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs mt-1 ${statusConfig[order.status]?.color || ""}`}>
                        {statusConfig[order.status]?.label}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
