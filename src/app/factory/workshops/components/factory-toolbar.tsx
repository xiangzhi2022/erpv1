'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LayoutGrid,
  List,
  Search,
  X,
} from 'lucide-react';

interface FactoryToolbarProps {
  viewMode: 'card' | 'table';
  onViewModeChange: (mode: 'card' | 'table') => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
}

export function FactoryToolbar({
  viewMode,
  onViewModeChange,
  statusFilter,
  onStatusFilterChange,
  keyword,
  onKeywordChange,
}: FactoryToolbarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onKeywordChange(value);
    }, 300);
  }, [onKeywordChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="搜索车间名称、编号..."
          className="pl-9 pr-8 h-9"
          defaultValue={keyword}
          onChange={(e) => handleInputChange(e.target.value)}
        />
        {keyword && (
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
            onClick={() => {
              onKeywordChange('');
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-full sm:w-[140px] h-9">
          <SelectValue placeholder="全部状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          <SelectItem value="normal">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              正常运行
            </span>
          </SelectItem>
          <SelectItem value="maintenance">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              检修中
            </span>
          </SelectItem>
          <SelectItem value="stopped">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              已停工
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Active filters indicator */}
      {statusFilter !== 'all' && (
        <Badge
          variant="secondary"
          className="cursor-pointer gap-1"
          onClick={() => onStatusFilterChange('all')}
        >
          {statusFilter === 'normal' ? '正常' : statusFilter === 'maintenance' ? '检修' : '停工'}
          <X className="h-3 w-3" />
        </Badge>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* View Toggle */}
      <div className="flex items-center border rounded-lg p-0.5">
        <Button
          variant={viewMode === 'card' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5"
          onClick={() => onViewModeChange('card')}
        >
          <LayoutGrid className="h-3.5 w-3.5 mr-1" />
          卡片
        </Button>
        <Button
          variant={viewMode === 'table' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-2.5"
          onClick={() => onViewModeChange('table')}
        >
          <List className="h-3.5 w-3.5 mr-1" />
          列表
        </Button>
      </div>
    </div>
  );
}
