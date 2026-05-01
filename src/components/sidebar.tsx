'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
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
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navigation = [
  { name: '首页', href: '/dashboard', icon: LayoutDashboard },
  { name: '订单管理', href: '/orders', icon: ClipboardList },
  { name: '任务分配', href: '/tasks', icon: CheckSquare },
  { name: '进度管理', href: '/progress', icon: TrendingUp },
  { name: '发货管理', href: '/shipping', icon: Truck },
  { name: '财务管理', href: '/finance', icon: DollarSign },
  { name: '数字看板', href: '/board', icon: BarChart3 },
];

interface UserInfo {
  id: string;
  phone: string;
  nickname: string;
  role: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从 Cookie 获取用户信息
    const checkAuth = () => {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'user_info') {
          try {
            const userInfo = JSON.parse(decodeURIComponent(value));
            setUser(userInfo);
          } catch {
            setUser(null);
          }
          break;
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // 清除 Cookie
      document.cookie = 'user_info=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      router.push('/login');
    } catch (error) {
      console.error('退出失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen">
        <div className="p-4 border-b border-sidebar-border">
          <div className="animate-pulse">
            <div className="h-5 bg-gray-300 rounded w-32 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen">
        <div className="p-4 border-b border-sidebar-border">
          <div>
            <h2 className="font-semibold text-lg text-destructive">未登录</h2>
            <p className="text-sm text-muted-foreground">请先登录</p>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <Link href="/login">
            <Button>去登录</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen">
      {/* Logo & User Info */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg truncate">青崖管理系统</h2>
            <p className="text-sm text-muted-foreground truncate">
              {user.nickname || user.phone}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded inline-block">
          {user.role === 'super_admin' ? '超级管理员' : user.role === 'admin' ? '管理员' : '普通用户'}
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
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5" />
          退出登录
        </button>
      </div>
    </div>
  );
}
