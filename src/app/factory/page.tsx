
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ClipboardList, Clock, Factory, Package, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface FactoryOrder {
  id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  delivery_date: string;
  remark: string;
  created_at: string;
  updated_at: string;
  total_tasks: number;
  completed_tasks: number;
  progress: number;
  dealer?: { id: string; name: string };
  items?: { id: string; product_name: string; quantity: number; unit_price: number }[];
}

interface OrderStats {
  pending: number;
  confirmed: number;
  producing: number;
  shipped: number;
  completed: number;
}

interface TaskStats {
  total: number;
  completed: number;
}

const t = {
  title: "\u5de5\u5382\u7ba1\u7406\u540e\u53f0",
  subtitle: "\u751f\u4ea7\u8c03\u5ea6\u770b\u677f\uff0c\u7ba1\u7406\u8ba2\u5355\u548c\u5de5\u5e8f",
  refresh: "\u5237\u65b0\u6570\u636e",
  pendingOrders: "\u5f85\u63a5\u6536\u8ba2\u5355",
  producingOrders: "\u751f\u4ea7\u4e2d\u8ba2\u5355",
  allTasks: "\u5168\u90e8\u5de5\u5e8f",
  completion: "\u5b8c\u6210\u8fdb\u5ea6",
  workshop: "\u8f66\u95f4\u7ba1\u7406",
  workshopDesc: "\u7ba1\u7406\u751f\u4ea7\u8f66\u95f4",
  progress: "\u751f\u4ea7\u8fdb\u5ea6",
  progressDesc: "\u67e5\u770b\u5de5\u5355\u8fdb\u5ea6",
  shipping: "\u53d1\u8d27\u7ba1\u7406",
  shippingDesc: "\u7ba1\u7406\u53d1\u8d27\u4fe1\u606f",
  noPending: "\u6682\u65e0\u5f85\u63a5\u6536\u8ba2\u5355",
  noProducing: "\u6682\u65e0\u751f\u4ea7\u4e2d\u7684\u8ba2\u5355",
  loading: "\u6570\u636e\u52a0\u8f7d\u4e2d...",
  accept: "\u63a5\u5355",
  delivery: "\u4ea4\u8d27",
  tasks: "\u5de5\u5e8f",
  yuan: "\u00a5",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "\u5f85\u63a5\u6536", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  confirmed: { label: "\u5df2\u63a5\u6536", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  producing: { label: "\u751f\u4ea7\u4e2d", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  shipped: { label: "\u5df2\u53d1\u8d27", className: "bg-purple-50 text-purple-700 ring-purple-200" },
  completed: { label: "\u5df2\u5b8c\u6210", className: "bg-green-50 text-green-700 ring-green-200" },
};

export default function FactoryDashboard() {
  const [orders, setOrders] = useState<FactoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<OrderStats>({ pending: 0, confirmed: 0, producing: 0, shipped: 0, completed: 0 });
  const [taskStats, setTaskStats] = useState<TaskStats>({ total: 0, completed: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/factory/orders");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOrders(data.orders || []);
          setOrderStats(data.stats || { pending: 0, confirmed: 0, producing: 0, shipped: 0, completed: 0 });
          setTaskStats(data.taskStats || { total: 0, completed: 0 });
        }
      }
    } catch (error) {
      console.error("Failed to load factory dashboard", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAcceptOrder = async (orderId: string) => {
    const res = await fetch("/api/factory/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
    if (res.ok) await fetchData();
  };

  const pendingOrders = useMemo(() => orders.filter((order) => order.status === "pending"), [orders]);
  const producingOrders = useMemo(() => orders.filter((order) => order.status === "producing"), [orders]);
  const progressPercent = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;

  const formatPrice = (price: number) => (price / 100).toFixed(2);
  const formatDate = (dateStr: string) => (dateStr ? new Date(dateStr).toLocaleDateString("zh-CN") : "-");

  const statCards = [
    { label: t.pendingOrders, value: orderStats.pending, icon: Clock, accent: "text-amber-600", bg: "bg-amber-50" },
    { label: t.producingOrders, value: orderStats.producing, icon: Package, accent: "text-emerald-600", bg: "bg-emerald-50" },
    { label: t.allTasks, value: taskStats.total, icon: ClipboardList, accent: "text-blue-600", bg: "bg-blue-50" },
    { label: t.completion, value: `${progressPercent}%`, icon: BarChart3, accent: "text-cyan-600", bg: "bg-cyan-50" },
  ];

  const actionCards = [
    { href: "/factory/workshops", title: t.workshop, desc: t.workshopDesc, icon: Factory, className: "from-blue-600 to-indigo-600" },
    { href: "/progress", title: t.progress, desc: t.progressDesc, icon: ClipboardList, className: "from-emerald-600 to-teal-600" },
    { href: "/shipping", title: t.shipping, desc: t.shippingDesc, icon: Truck, className: "from-fuchsia-600 to-violet-600" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200 ring-1 ring-white/15">
              <Factory className="h-4 w-4" />
              {t.title}
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t.title}</h1>
            <p className="mt-3 max-w-2xl text-slate-300">{t.subtitle}</p>
          </div>
          <Button variant="secondary" onClick={fetchData}>{t.refresh}</Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <div className={`mt-2 text-3xl font-bold ${card.accent}`}>{loading ? <Skeleton className="h-9 w-16" /> : card.value}</div>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.bg}`}>
                <card.icon className={`h-6 w-6 ${card.accent}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {actionCards.map((card) => (
          <Link key={card.href} href={card.href} className={`group rounded-3xl bg-gradient-to-br ${card.className} p-6 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl`}>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 ring-1 ring-white/20">
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{card.title}</h3>
                <p className="mt-1 text-sm text-white/80">{card.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <OrderPanel title={t.pendingOrders} icon={Clock} orders={pendingOrders} loading={loading} emptyText={t.noPending} renderAction={(order) => (
          <Button size="sm" onClick={() => handleAcceptOrder(order.id)}>{t.accept}</Button>
        )} formatDate={formatDate} formatPrice={formatPrice} />
        <OrderPanel title={t.producingOrders} icon={ClipboardList} orders={producingOrders} loading={loading} emptyText={t.noProducing} formatDate={formatDate} formatPrice={formatPrice} />
      </section>
    </div>
  );
}

function OrderPanel({
  title,
  icon: Icon,
  orders,
  loading,
  emptyText,
  renderAction,
  formatDate,
  formatPrice,
}: {
  title: string;
  icon: typeof Clock;
  orders: FactoryOrder[];
  loading: boolean;
  emptyText: string;
  renderAction?: (order: FactoryOrder) => React.ReactNode;
  formatDate: (value: string) => string;
  formatPrice: (value: number) => string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{orders.length > 0 ? `${orders.length} ${"\u6761\u8bb0\u5f55"}` : emptyText}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed bg-muted/30 text-muted-foreground">{emptyText}</div>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 4).map((order) => (
              <div key={order.id} className="rounded-2xl border bg-background p-4 transition hover:border-primary/30 hover:shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">{order.order_no}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{order.customer_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{t.yuan}{formatPrice(order.total_amount)}</div>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs ring-1 ${statusConfig[order.status]?.className || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
                      {statusConfig[order.status]?.label || order.status}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{t.delivery}: {formatDate(order.delivery_date)}</span>
                  {renderAction ? renderAction(order) : <span>{t.tasks}: {order.completed_tasks}/{order.total_tasks}</span>}
                </div>
                {!renderAction ? <Progress value={order.progress || 0} className="mt-3 h-2" /> : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
