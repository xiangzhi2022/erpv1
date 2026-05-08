"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getCategories } from "@/app/actions/categories";
import { getTasks, getTaskStats } from "@/app/actions/tasks";

interface SyncResult {
  table: string;
  status: "success" | "error";
  count?: number;
  message?: string;
  duration?: number;
}

export function SyncContent() {
  const [results, setResults] = useState<SyncResult[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function runSync() {
    setSyncing(true);
    setResults([]);
    const syncResults: SyncResult[] = [];

    // 测试 1: 分类表读取
    const t1 = Date.now();
    try {
      const cats = await getCategories();
      syncResults.push({
        table: "categories (SELECT)",
        status: "success",
        count: cats.length,
        duration: Date.now() - t1,
      });
    } catch (e: unknown) {
      syncResults.push({
        table: "categories (SELECT)",
        status: "error",
        message: e instanceof Error ? e.message : "查询失败",
        duration: Date.now() - t1,
      });
    }
    setResults([...syncResults]);

    // 测试 2: 任务表读取
    const t2 = Date.now();
    try {
      const tasksResult = await getTasks();
      syncResults.push({
        table: "tasks (SELECT)",
        status: "success",
        count: tasksResult.tasks.length,
        duration: Date.now() - t2,
      });
    } catch (e: unknown) {
      syncResults.push({
        table: "tasks (SELECT)",
        status: "error",
        message: e instanceof Error ? e.message : "查询失败",
        duration: Date.now() - t2,
      });
    }
    setResults([...syncResults]);

    // 测试 3: 任务统计
    const t3 = Date.now();
    try {
      const stats = await getTaskStats();
      syncResults.push({
        table: "tasks (COUNT/STATS)",
        status: "success",
        count: stats.total,
        message: `完成${stats.completed} / 待处理${stats.pending}`,
        duration: Date.now() - t3,
      });
    } catch (e: unknown) {
      syncResults.push({
        table: "tasks (COUNT/STATS)",
        status: "error",
        message: e instanceof Error ? e.message : "统计失败",
        duration: Date.now() - t3,
      });
    }
    setResults([...syncResults]);

    // 测试 4: 创建分类 (INSERT)
    const t4 = Date.now();
    try {
      const { createCategory } = await import("@/app/actions/categories");
      const cat = await createCategory({
        name: `同步测试_${Date.now()}`,
        color: "#10b981",
        description: "数据同步测试 - 自动创建",
      });
      syncResults.push({
        table: "categories (INSERT)",
        status: "success",
        count: 1,
        message: `创建ID: ${cat.id.slice(0, 8)}...`,
        duration: Date.now() - t4,
      });

      // 测试 5: 更新分类 (UPDATE)
      const t5 = Date.now();
      try {
        const { updateCategory } = await import("@/app/actions/categories");
        await updateCategory(cat.id, { name: `${cat.name}_已更新` });
        syncResults.push({
          table: "categories (UPDATE)",
          status: "success",
          count: 1,
          message: `更新ID: ${cat.id.slice(0, 8)}...`,
          duration: Date.now() - t5,
        });
      } catch (e: unknown) {
        syncResults.push({
          table: "categories (UPDATE)",
          status: "error",
          message: e instanceof Error ? e.message : "更新失败",
          duration: Date.now() - t5,
        });
      }
      setResults([...syncResults]);

      // 测试 6: 删除分类 (DELETE)
      const t6 = Date.now();
      try {
        const { deleteCategory } = await import("@/app/actions/categories");
        await deleteCategory(cat.id);
        syncResults.push({
          table: "categories (DELETE)",
          status: "success",
          count: 1,
          message: `删除ID: ${cat.id.slice(0, 8)}...`,
          duration: Date.now() - t6,
        });
      } catch (e: unknown) {
        syncResults.push({
          table: "categories (DELETE)",
          status: "error",
          message: e instanceof Error ? e.message : "删除失败",
          duration: Date.now() - t6,
        });
      }
    } catch (e: unknown) {
      syncResults.push({
        table: "categories (INSERT)",
        status: "error",
        message: e instanceof Error ? e.message : "创建失败",
        duration: Date.now() - t4,
      });
    }
    setResults([...syncResults]);

    setSyncing(false);
  }

  const successCount = results.filter((r) => r.status === "success").length;
  const failCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">数据同步验证</h2>
          <p className="text-muted-foreground mt-1">
            验证数据库读写同步 - 完整增删改查测试
          </p>
        </div>
        <Button onClick={runSync} disabled={syncing}>
          {syncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {syncing ? "同步中..." : "运行同步测试"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              测试项
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              通过
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {successCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              失败
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5" />
            同步测试结果
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              点击&quot;运行同步测试&quot;开始验证
            </p>
          ) : (
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {result.status === "success" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <span className="font-medium text-sm">
                        {result.table}
                      </span>
                      {result.message && (
                        <p className="text-xs text-muted-foreground">
                          {result.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {result.count !== undefined && (
                      <Badge variant="secondary">
                        {result.count} 行
                      </Badge>
                    )}
                    {result.duration !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {result.duration}ms
                      </span>
                    )}
                    <Badge
                      variant={
                        result.status === "success" ? "default" : "destructive"
                      }
                    >
                      {result.status === "success" ? "通过" : "失败"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
