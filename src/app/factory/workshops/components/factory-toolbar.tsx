"use client";

import { WorkshopStatusType } from "../schemas";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, List, Search, X } from "lucide-react";

interface FactoryToolbarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  viewMode: "card" | "table";
  onViewModeChange: (mode: "card" | "table") => void;
  totalCount: number;
  normalCount: number;
  maintenanceCount: number;
  stoppedCount: number;
}

export function FactoryToolbar({
  keyword,
  onKeywordChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  totalCount,
  normalCount,
  maintenanceCount,
  stoppedCount,
}: FactoryToolbarProps) {
  return (
    <div className="space-y-4">
      {/* 快捷状态筛选标签 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onStatusFilterChange("all")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statusFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          全部
          <span className="text-xs opacity-70">{totalCount}</span>
        </button>
        <button
          onClick={() => onStatusFilterChange("normal")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statusFilter === "normal"
              ? "bg-emerald-600 text-white"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          正常
          <span className="text-xs opacity-70">{normalCount}</span>
        </button>
        <button
          onClick={() => onStatusFilterChange("maintenance")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statusFilter === "maintenance"
              ? "bg-amber-600 text-white"
              : "bg-amber-50 text-amber-700 hover:bg-amber-100"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          检修中
          <span className="text-xs opacity-70">{maintenanceCount}</span>
        </button>
        <button
          onClick={() => onStatusFilterChange("stopped")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statusFilter === "stopped"
              ? "bg-red-600 text-white"
              : "bg-red-50 text-red-700 hover:bg-red-100"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          停工
          <span className="text-xs opacity-70">{stoppedCount}</span>
        </button>
      </div>

      {/* 搜索栏 + 视图切换 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索车间名称、编号、负责人..."
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {keyword && (
            <button
              onClick={() => onKeywordChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center border rounded-lg p-0.5">
          <Button
            variant={viewMode === "card" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewModeChange("card")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => onViewModeChange("table")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
