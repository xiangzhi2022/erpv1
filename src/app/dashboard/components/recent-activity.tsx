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
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Users,
  UserPlus,
  ListTodo,
  Truck,
  Activity,
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
  { icon: typeof FileText; color: string; bgColor: string; label: string }
> = {
  order: {
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20',
    label: '订单',
  },
  tenant: {
    icon: Users,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    label: '租户',
  },
  customer: {
    icon: UserPlus,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-500/10 dark:bg-violet-500/20',
    label: '客户',
  },
  task: {
    icon: ListTodo,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10 dark:bg-orange-500/20',
    label: '任务',
  },
  shipping: {
    icon: Truck,
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    label: '发货',
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
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>近期动态</CardTitle>
              <CardDescription>系统最新操作记录</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
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
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>近期动态</CardTitle>
            <CardDescription>系统最新操作记录</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-3">
            <Activity className="h-10 w-10 opacity-30" />
            <div className="text-center">
              <p className="text-sm font-medium">暂无动态</p>
              <p className="text-xs mt-1">系统产生操作后将自动展示</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[360px] pr-3">
            <div className="space-y-3">
              {activities.map((activity) => {
                const config = typeConfig[activity.type] || typeConfig.order;
                const IconComp = config.icon;

                return (
                  <div
                    key={`${activity.id}-${activity.timestamp}`}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback
                        className={cn(config.bgColor, config.color, 'text-xs')}
                      >
                        <IconComp className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium leading-tight truncate">
                          {activity.title}
                        </p>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {activity.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
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
