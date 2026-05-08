"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  Database,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/categories", label: "分类管理", icon: FolderOpen },
  { href: "/tasks", label: "任务管理", icon: CheckSquare },
  { href: "/sync", label: "数据同步", icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col min-h-screen">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold tracking-tight">核心模块联调</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Next.js + Supabase CRUD
        </p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Server Actions + Supabase</p>
          <p>数据库同步 + RLS 校验</p>
        </div>
      </div>
    </aside>
  );
}
