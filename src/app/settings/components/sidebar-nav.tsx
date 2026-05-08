'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  User,
  Palette,
  Shield,
  Building2,
  Users,
  KeyRound,
  Settings2,
} from 'lucide-react';

const sidebarNavItems = [
  {
    title: '个人资料',
    href: '/settings/profile',
    icon: User,
  },
  {
    title: '外观设置',
    href: '/settings/appearance',
    icon: Palette,
  },
  {
    title: '账号安全',
    href: '/settings/security',
    icon: Shield,
  },
  {
    title: '公司信息',
    href: '/settings/company',
    icon: Building2,
  },
  {
    title: '用户管理',
    href: '/settings/users',
    icon: Users,
  },
  {
    title: '角色权限',
    href: '/settings/roles',
    icon: KeyRound,
  },
  {
    title: '系统配置',
    href: '/settings/system',
    icon: Settings2,
  },
];

export function SettingsSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-2">
      {sidebarNavItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/settings' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
