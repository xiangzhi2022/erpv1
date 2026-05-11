'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import {
  Sidebar as BaseSidebar,
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
import {
  getAccountRoleLabel,
  getNavigationForUser,
  getUserPermissionKeys,
  getPermissionLabel,
  type AccessUser,
} from '@/lib/role-access';

function getDisplayName(user?: AccessUser | null): string {
  return user?.nickname || user?.name || user?.phone || '当前账号';
}

function getInitial(user?: AccessUser | null): string {
  return getDisplayName(user).trim().slice(0, 1).toUpperCase() || 'U';
}

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
      {state === 'collapsed' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </Button>
  );
}

interface AppSidebarProps {
  user?: AccessUser | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navigation = getNavigationForUser(user);
  const groupedItems = navigation.reduce<Record<string, typeof navigation>>((groups, item) => {
    const key = item.group;
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});

  const labels: Record<string, string> = {
    main: '导航菜单',
    workflow: '业务流转',
    portal: '门户入口',
    admin: '管理中心',
  };

  const permissionText = getUserPermissionKeys(user)
    .slice(0, 2)
    .map(getPermissionLabel)
    .join('、');

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/login');
    router.refresh();
  };

  return (
    <BaseSidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            E
          </div>
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">ERP 管理平台</span>
        </div>
        <div className="mt-4 rounded-xl bg-sidebar-accent p-2">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-background/70 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            title="个人资料"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {getInitial(user)}
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate text-sm font-medium">{getDisplayName(user)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {user?.phone || '已登录'}
              </div>
              <div className="mt-1 truncate text-[11px] text-muted-foreground">
                {getAccountRoleLabel(user?.role)}
                {permissionText ? ` · ${permissionText}` : ''}
              </div>
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="mt-2 w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="group-data-[collapsible=icon]:hidden">退出登录</span>
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {(['main', 'workflow', 'portal', 'admin'] as const).map((group) => {
          const items = groupedItems[group] || [];
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{labels[group]}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">v1.0.0</span>
          <SidebarToggle />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </BaseSidebar>
  );
}

export { AppSidebar as Sidebar };
