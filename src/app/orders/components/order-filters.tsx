'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, RotateCcw } from 'lucide-react';

interface OrderFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function OrderFilters({ search, onSearchChange }: OrderFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索订单号或客户名称..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
      {search && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSearchChange('')}
          className="gap-1"
        >
          <RotateCcw className="h-3.5 w-3.5" /> 清除
        </Button>
      )}
    </div>
  );
}
