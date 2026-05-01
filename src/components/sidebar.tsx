'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { 
  LayoutDashboard, 
  ClipboardList, 
  CheckSquare, 
  TrendingUp, 
  Truck, 
  BarChart3,
  Settings,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navigation = [
  { name: '首页', href: '/dashboard', icon: LayoutDashboard },
  { name: '订单管理', href: '/orders', icon: ClipboardList },
  { name: '任务分配', href: '/tasks', icon: CheckSquare },
  { name: '进度管理', href: '/progress', icon: TrendingUp },
  { name: '发货管理', href: '/shipping', icon: Truck },
  { name: '数字看板', href: '/board', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Image 
              src="https://coze-coding-project.tos.coze.site/coze_storage_7634891394569633846/image/generate_image_4f91f523-a5ee-4398-9409-14ece2d44ffd.jpeg?sign=1809177312-fcf7daff87-0-54fd4be4bf9107db06d578042a2c344effa00d166a93b3c864ed092ebcb87861" 
              alt="青崖Logo" 
              width={32} 
              height={32}
              className="object-contain"
            />
          </div>
          <div>
            <h2 className="font-semibold text-sm">青崖管理系统</h2>
            <p className="text-xs text-muted-foreground">管理员：daoxi</p>
          </div>
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
