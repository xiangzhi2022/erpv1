'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderTree,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import * as React from 'react';

const navItems = [
  {
    title: '仪表盘',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: '分类管理',
    href: '/categories',
    icon: FolderTree,
  },
  {
    title: '数据同步',
    href: '/sync',
    icon: RefreshCw,
  },
] as const;

function SidebarToggle() {
  const { toggleSidebar, state } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={toggleSidebar}
      aria-label={state === 'collapsed' ? '展开侧边栏' : '收起侧边栏'}
    >
      {state === 'collapsed' ? (
        <ChevronRight className="h-4 w-4" />
      ) : (
        <ChevronLeft className="h-4 w-4" />
      )}
    </Button>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            E
          </div>
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
            ERP 管理平台
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航菜单</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/' || pathname === ''
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            v1.0.0
          </span>
          <SidebarToggle />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
