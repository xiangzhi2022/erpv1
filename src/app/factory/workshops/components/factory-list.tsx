"use client";

import { Workshop, WorkshopStats, WorkshopStatusType, statusConfig } from "../schemas";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Factory,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Wrench,
  Ban,
  Play,
} from "lucide-react";
import { useState } from "react";

interface FactoryListProps {
  workshops: Workshop[];
  stats: WorkshopStats;
  viewMode: "card" | "table";
  onEdit: (workshop: Workshop) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: WorkshopStatusType) => void;
}

function getLoadColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function getProgressClassName(percentage: number): string {
  if (percentage >= 90) return "[&>div]:bg-red-500";
  if (percentage >= 70) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-emerald-500";
}

export function FactoryList({
  workshops,
  stats,
  viewMode,
  onEdit,
  onDelete,
  onStatusChange,
}: FactoryListProps) {
  const [deleteTarget, setDeleteTarget] = useState<Workshop | null>(null);
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    workshop: Workshop;
    newStatus: WorkshopStatusType;
  } | null>(null);

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleStatusConfirm = () => {
    if (statusChangeTarget) {
      onStatusChange(
        statusChangeTarget.workshop.id,
        statusChangeTarget.newStatus
      );
      setStatusChangeTarget(null);
    }
  };

  const getNextStatusOptions = (
    currentStatus: WorkshopStatusType
  ): { status: WorkshopStatusType; label: string; icon: React.ReactNode }[] => {
    const options: {
      status: WorkshopStatusType;
      label: string;
      icon: React.ReactNode;
    }[] = [];
    if (currentStatus !== "normal") {
      options.push({
        status: "normal",
        label: "恢复正常",
        icon: <Play className="h-4 w-4" />,
      });
    }
    if (currentStatus !== "maintenance") {
      options.push({
        status: "maintenance",
        label: "标记检修",
        icon: <Wrench className="h-4 w-4" />,
      });
    }
    if (currentStatus !== "stopped") {
      options.push({
        status: "stopped",
        label: "标记停工",
        icon: <Ban className="h-4 w-4" />,
      });
    }
    return options;
  };

  // 卡片视图
  if (viewMode === "card") {
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workshops.map((workshop) => {
            const config = statusConfig[workshop.status];
            const loadPct = workshop.load_percentage;

            return (
              <Card
                key={workshop.id}
                className="relative group hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          workshop.status === "normal"
                            ? "bg-emerald-100"
                            : workshop.status === "maintenance"
                            ? "bg-amber-100"
                            : "bg-red-100"
                        }`}
                      >
                        <Factory
                          className={`h-5 w-5 ${
                            workshop.status === "normal"
                              ? "text-emerald-600"
                              : workshop.status === "maintenance"
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">
                          {workshop.name}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono">
                          {workshop.factory_code}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`${config.bgColor} ${config.color} border text-xs`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${config.dotColor} mr-1`}
                        />
                        {config.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => onEdit(workshop)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            编辑信息
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {getNextStatusOptions(workshop.status).map((opt) => (
                            <DropdownMenuItem
                              key={opt.status}
                              onClick={() =>
                                setStatusChangeTarget({
                                  workshop,
                                  newStatus: opt.status,
                                })
                              }
                            >
                              {opt.icon}
                              <span className="ml-2">{opt.label}</span>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(workshop)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除车间
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {workshop.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">位置</span>
                        <span className="font-medium text-foreground">
                          {workshop.location}
                        </span>
                      </div>
                    )}
                    {workshop.manager && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">负责人</span>
                        <span className="font-medium text-foreground">
                          {workshop.manager}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 产能进度 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">产能负荷</span>
                      <span className="font-semibold">
                        {workshop.current_load} / {workshop.capacity}
                      </span>
                    </div>
                    <Progress
                      value={loadPct}
                      className={`h-2 ${getProgressClassName(loadPct)}`}
                    />
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          loadPct >= 90
                            ? "text-red-600"
                            : loadPct >= 70
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }`}
                      >
                        负荷率 {loadPct}%
                      </span>
                    </div>
                  </div>

                  {workshop.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {workshop.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 空状态 */}
        {workshops.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Factory className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">暂无车间数据</p>
            <p className="text-sm mt-1">点击右上角添加新的车间</p>
          </div>
        )}

        {/* 删除确认弹窗 */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除车间</AlertDialogTitle>
              <AlertDialogDescription>
                你确定要删除车间「{deleteTarget?.name}」({deleteTarget?.factory_code})
                吗？此操作不可撤销，该车间下的所有关联数据也将被清除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 状态变更确认弹窗 */}
        <AlertDialog
          open={!!statusChangeTarget}
          onOpenChange={(open: boolean) => !open && setStatusChangeTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认变更状态</AlertDialogTitle>
              <AlertDialogDescription>
                你确定要将车间「{statusChangeTarget?.workshop.name}」的状态变更为
                「{statusChangeTarget
                  ? statusConfig[statusChangeTarget.newStatus].label
                  : ""}
                」吗？
                {statusChangeTarget?.newStatus === "stopped" &&
                  "停工后该车间将不再接受新任务。"}
                {statusChangeTarget?.newStatus === "maintenance" &&
                  "检修期间该车间产能将暂停统计。"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleStatusConfirm}>
                确认变更
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // 表格视图
  return (
    <>
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">编号</th>
                <th className="text-left p-3 font-medium">车间名称</th>
                <th className="text-left p-3 font-medium">位置</th>
                <th className="text-left p-3 font-medium">负责人</th>
                <th className="text-left p-3 font-medium">产能负荷</th>
                <th className="text-left p-3 font-medium">状态</th>
                <th className="text-right p-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {workshops.map((workshop) => {
                const config = statusConfig[workshop.status];
                const loadPct = workshop.load_percentage;

                return (
                  <tr
                    key={workshop.id}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3 font-mono text-xs">
                      {workshop.factory_code}
                    </td>
                    <td className="p-3 font-medium">{workshop.name}</td>
                    <td className="p-3 text-muted-foreground">
                      {workshop.location || "-"}
                    </td>
                    <td className="p-3">{workshop.manager || "-"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-3 min-w-[160px]">
                        <Progress
                          value={loadPct}
                          className={`h-2 flex-1 ${getProgressClassName(loadPct)}`}
                        />
                        <span
                          className={`text-xs font-medium whitespace-nowrap ${
                            loadPct >= 90
                              ? "text-red-600"
                              : loadPct >= 70
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {loadPct}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant="outline"
                        className={`${config.bgColor} ${config.color} border text-xs`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${config.dotColor} mr-1`}
                        />
                        {config.label}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(workshop)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {getNextStatusOptions(workshop.status).map(
                              (opt) => (
                                <DropdownMenuItem
                                  key={opt.status}
                                  onClick={() =>
                                    setStatusChangeTarget({
                                      workshop,
                                      newStatus: opt.status,
                                    })
                                  }
                                >
                                  {opt.icon}
                                  <span className="ml-2">{opt.label}</span>
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(workshop)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {workshops.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Factory className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">暂无车间数据</p>
            <p className="text-sm mt-1">点击右上角添加新的车间</p>
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除车间</AlertDialogTitle>
            <AlertDialogDescription>
              你确定要删除车间「{deleteTarget?.name}」({deleteTarget?.factory_code})
              吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 状态变更确认弹窗 */}
      <AlertDialog
        open={!!statusChangeTarget}
        onOpenChange={(open: boolean) => !open && setStatusChangeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认变更状态</AlertDialogTitle>
            <AlertDialogDescription>
              你确定要将车间「{statusChangeTarget?.workshop.name}」的状态变更为
              「{statusChangeTarget
                ? statusConfig[statusChangeTarget.newStatus].label
                : ""}
              」吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusConfirm}>
              确认变更
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
