'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { 
  LayoutDashboard, 
  ClipboardList, 
  CheckSquare, 
  TrendingUp, 
  Truck, 
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navigation = [
  { name: '首页', href: '/dashboard', icon: LayoutDashboard },
  { name: '订单管理', href: '/orders', icon: ClipboardList },
  { name: '任务分配', href: '/tasks', icon: CheckSquare },
  { name: '进度管理', href: '/progress', icon: TrendingUp },
  { name: '供应商管理', href: '/supplier', icon: Building2 },
  { name: '发货管理', href: '/shipping', icon: Truck },
  { name: '财务管理', href: '/finance', icon: DollarSign },
  { name: '数字看板', href: '/board', icon: BarChart3 },
];

interface UserInfo {
  id: string;
  phone: string;
  nickname?: string;
  role: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    // 从 Cookie 中读取用户信息
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);
    
    if (cookies['erp_user']) {
      try {
        const user = JSON.parse(cookies['erp_user']);
        setUserInfo(user);
      } catch (e) {
        console.error('解析用户信息失败', e);
      }
    } else {
      setUserInfo(null);
    }
  }, [pathname]);

  const displayName = userInfo?.nickname || userInfo?.phone || '未登录';

  return (
    <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div>
          <h2 className="font-semibold text-lg">青崖管理系统</h2>
          <p className="text-sm text-muted-foreground">管理员：{displayName}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Bottom actions */}
      <div className="p-4 space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Settings className="h-5 w-5" />
          系统设置
        </Link>
        <Link
          href="/login"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5" />
          退出登录
        </Link>
      </div>
    </div>
  );
}
