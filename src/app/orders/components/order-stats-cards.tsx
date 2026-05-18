'use client';

import { Ban, CheckCircle2, ClipboardList, Clock, Package, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { OrderStats } from '../schemas';

interface OrderStatsCardsProps {
  stats: OrderStats | null;
  loading: boolean;
}

const statItems = [
  { key: 'total' as const, label: '全部订单', icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
  { key: 'pending' as const, label: '待接收', icon: Clock, color: 'text-orange-600 bg-orange-50' },
  { key: 'producing' as const, label: '生产中', icon: Package, color: 'text-yellow-600 bg-yellow-50' },
  { key: 'shipped' as const, label: '已发货', icon: Truck, color: 'text-green-600 bg-green-50' },
  { key: 'completed' as const, label: '已完成', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  { key: 'returned' as const, label: '已退回', icon: Ban, color: 'text-red-600 bg-red-50' },
];

export function OrderStatsCards({ stats, loading }: OrderStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {statItems.map((item) => {
        const Icon = item.icon;
        const value = stats?.[item.key] ?? 0;
        return (
          <Card key={item.key} className="transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${item.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loading ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-muted" /> : value}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
