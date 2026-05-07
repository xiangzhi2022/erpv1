'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Users,
  UserPlus,
  ListTodo,
  Truck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  type: 'order' | 'tenant' | 'customer' | 'task' | 'shipping';
  title: string;
  description: string;
  timestamp: string;
  operatorName?: string;
}

const typeConfig: Record<
  string,
  { icon: typeof FileText; color: string; bgColor: string; fallback: string }
> = {
  order: {
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    fallback: '订',
  },
  tenant: {
    icon: Users,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
    fallback: '租',
  },
  customer: {
    icon: UserPlus,
    color: 'text-violet-600',
    bgColor: 'bg-violet-500/10',
    fallback: '客',
  },
  task: {
    icon: ListTodo,
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10',
    fallback: '任',
  },
  shipping: {
    icon: Truck,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-500/10',
    fallback: '发',
  },
};

function formatRelativeTime(timestamp: string): string {
  try {
    return formatDistanceToNow(new Date(timestamp), {
      addSuffix: true,
      locale: zhCN,
    });
  } catch {
    return timestamp;
  }
}

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/activity');
      if (res.ok) {
        const result = await res.json();
        setActivities(result.data || []);
      }
    } catch (err) {
      console.error('Fetch activity error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>近期动态</CardTitle>
          <CardDescription>系统最新操作记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>近期动态</CardTitle>
        <CardDescription>系统最新操作记录</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            暂无动态
          </div>
        ) : (
          <ScrollArea className="h-[360px] pr-3">
            <div className="space-y-4">
              {activities.map((activity) => {
                const config = typeConfig[activity.type] || typeConfig.order;
                const IconComp = config.icon;

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 group"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback
                        className={cn(config.bgColor, config.color, 'text-xs font-medium')}
                      >
                        <IconComp className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {formatRelativeTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
