'use client';

import { CRAFT_TYPES } from '../schemas';

interface CraftDistributionProps {
  distribution: Record<string, number>;
}

const CRAFT_COLORS: Record<string, string> = {
  cutting: 'bg-blue-500',
  sewing: 'bg-green-500',
  qc: 'bg-orange-500',
  packaging: 'bg-purple-500',
  ironing: 'bg-pink-500',
  pattern: 'bg-cyan-500',
  cutting_die: 'bg-amber-500',
  assembly: 'bg-teal-500',
  other: 'bg-gray-500',
};

export function CraftDistribution({ distribution }: CraftDistributionProps) {
  const total = Object.values(distribution).reduce((sum, v) => sum + v, 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-medium mb-3">工种分布</h3>
        <p className="text-sm text-muted-foreground">暂无数据</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-sm font-medium mb-3">工种分布</h3>
      <div className="space-y-3">
        {Object.entries(distribution)
          .sort(([, a], [, b]) => b - a)
          .map(([craft, count]) => {
            const percentage = Math.round((count / total) * 100);
            const label = CRAFT_TYPES.find(c => c.value === craft)?.label || (craft === '未分配' ? '未分配' : craft);
            const colorClass = CRAFT_COLORS[craft] || 'bg-gray-400';
            return (
              <div key={craft}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{count}人 ({percentage}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colorClass} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
