'use client';

import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface OrderFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function OrderFilters({ search, onSearchChange }: OrderFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索订单号或企业名称..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-9 pl-9"
        />
      </div>
      {search ? (
        <Button variant="ghost" size="sm" onClick={() => onSearchChange('')} className="gap-1">
          <RotateCcw className="h-3.5 w-3.5" />
          清除
        </Button>
      ) : null}
    </div>
  );
}
