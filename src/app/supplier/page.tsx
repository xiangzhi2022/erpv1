"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Plus, Clock, CheckCircle, Truck, AlertCircle, DollarSign, ShoppingCart } from "lucide-react";

interface MaterialOrder {
  id: string;
  order_no: string;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "待确认", color: "text-amber-600 bg-amber-50", icon: <Clock className="w-4 h-4" /> },
  confirmed: { label: "已确认", color: "text-blue-600 bg-blue-50", icon: <CheckCircle className="w-4 h-4" /> },
  shipped: { label: "已发货", color: "text-purple-600 bg-purple-50", icon: <Truck className="w-4 h-4" /> },
  completed: { label: "已完成", color: "text-green-600 bg-green-50", icon: <CheckCircle className="w-4 h-4" /> },
  cancelled: { label: "已取消", color: "text-red-600 bg-red-50", icon: <AlertCircle className="w-4 h-4" /> },
};

export default function SupplierDashboard() {
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    shipped: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/supplier/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        
        const statsData = {
          total: data.orders?.length || 0,
          pending: data.orders?.filter((o: MaterialOrder) => o.status === "pending").length || 0,
          confirmed: data.orders?.filter((o: MaterialOrder) => o.status === "confirmed").length || 0,
          shipped: data.orders?.filter((o: MaterialOrder) => o.status === "shipped").length || 0,
        };
        setStats(statsData);
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-6 ml-64">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">材料商管理</h1>
          <p className="text-muted-foreground mt-1">管理材料订单和库存</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">总订单</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">待确认</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已确认</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已发货</CardTitle>
              <Truck className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.shipped}</div>
            </CardContent>
          </Card>
        </div>

        {/* 订单列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>材料订单</CardTitle>
                <CardDescription>管理您的材料供应订单</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无订单数据
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const status = statusConfig[order.status] || statusConfig.pending;
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-lg">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium">{order.order_no}</div>
                          <div className="text-sm text-muted-foreground">
                            客户: {order.customer_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="font-medium flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {formatPrice(order.total_amount)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(order.created_at)}
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
