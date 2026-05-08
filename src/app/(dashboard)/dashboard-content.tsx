"use client";

import { CheckCircle2, Clock, FolderOpen, ListTodo } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardContentProps {
  stats: { total: number; completed: number; pending: number };
  categoryCount: number;
}

export function DashboardContent({ stats, categoryCount }: DashboardContentProps) {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const cards = [
    {
      title: "总任务数",
      value: stats.total,
      icon: ListTodo,
      description: "所有任务",
      color: "text-blue-600",
    },
    {
      title: "已完成",
      value: stats.completed,
      icon: CheckCircle2,
      description: `${completionRate}% 完成率`,
      color: "text-green-600",
    },
    {
      title: "待处理",
      value: stats.pending,
      icon: Clock,
      description: "等待完成",
      color: "text-orange-600",
    },
    {
      title: "分类数",
      value: categoryCount,
      icon: FolderOpen,
      description: "任务分类",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">仪表盘</h2>
        <p className="text-muted-foreground mt-1">
          核心模块联调 - 数据库同步与 CRUD 操作状态概览
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">联调状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Supabase 数据库连接</span>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                已连接
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Server Actions (CRUD)</span>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                正常
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">RLS 策略 (场景 A)</span>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                已启用
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">API 路由层</span>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                已部署
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
