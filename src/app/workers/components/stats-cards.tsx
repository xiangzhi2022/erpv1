'use client';

import { WorkerStats, WORKER_STATUSES } from '../schemas';
import { Users, UserCheck, UserX, TrendingUp } from 'lucide-react';

export function StatsCards({ stats }: { stats: WorkerStats }) {
  const cards = [
    { label: '总人数', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '在岗', value: stats.active, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { label: '请假', value: stats.onLeave, icon: UserX, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: '在岗率', value: `${stats.activeRate}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
