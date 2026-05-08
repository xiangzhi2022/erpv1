'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  Clock,
  Wrench,
  ClipboardCheck,
  PackageCheck,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProgressStats } from '../schemas';

interface StatsWidgetsProps {
  stats: ProgressStats;
  activeFilter?: string;
  onFilterClick?: (status: string) => void;
}

const statItems: Array<{
  key: keyof ProgressStats;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  activeBg: string;
  filterValue: string;
}> = [
  { key: 'total', label: '总工单', icon: <BarChart3 className="h-4 w-4" />, color: 'text-slate-600', bgColor: 'bg-slate-50', activeBg: 'bg-slate-100', filterValue: 'all' },
  { key: 'producing', label: '生产中', icon: <Wrench className="h-4 w-4" />, color: 'text-blue-600', bgColor: 'bg-blue-50', activeBg: 'bg-blue-100', filterValue: 'producing' },
  { key: 'inspecting', label: '质检中', icon: <ClipboardCheck className="h-4 w-4" />, color: 'text-amber-600', bgColor: 'bg-amber-50', activeBg: 'bg-amber-100', filterValue: 'inspecting' },
  { key: 'stored', label: '已入库', icon: <PackageCheck className="h-4 w-4" />, color: 'text-green-600', bgColor: 'bg-green-50', activeBg: 'bg-green-100', filterValue: 'stored' },
  { key: 'pending', label: '待排产', icon: <Clock className="h-4 w-4" />, color: 'text-slate-500', bgColor: 'bg-slate-50', activeBg: 'bg-slate-100', filterValue: 'pending' },
  { key: 'overdue', label: '已延期', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-600', bgColor: 'bg-red-50', activeBg: 'bg-red-100', filterValue: 'overdue' },
];

export function StatsWidgets({ stats, activeFilter = 'all', onFilterClick }: StatsWidgetsProps) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {statItems.map((item) => {
        const isActive = activeFilter === item.filterValue;
        const value = stats[item.key];
        const isOverdueItem = item.key === 'overdue' && value > 0;

        return (
          <Card
            key={item.key}
            className={cn(
              'py-0 cursor-pointer transition-all duration-200 hover:shadow-sm',
              isActive ? `ring-2 ring-primary/20 ${item.activeBg}` : '',
              isOverdueItem && !isActive ? 'animate-pulse' : ''
            )}
            onClick={() => onFilterClick?.(item.filterValue)}
          >
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className={cn('p-1.5 rounded-lg', item.bgColor, item.color)}>
                {item.icon}
              </div>
              <div>
                <p className={cn(
                  'text-lg font-bold leading-tight tabular-nums',
                  isOverdueItem ? 'text-red-600' : ''
                )}>
                  {value}
                </p>
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
