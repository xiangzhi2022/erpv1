'use client';

import { useState, useCallback } from 'react';
import { Search, Filter, RotateCcw, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type ProgressFilter = {
  keyword: string;
  status: string;
  workshop_id: string;
  priority: string;
};

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待排产' },
  { value: 'producing', label: '生产中' },
  { value: 'inspecting', label: '质检中' },
  { value: 'stored', label: '已入库' },
  { value: 'aborted', label: '异常中止' },
];

const priorityOptions = [
  { value: 'all', label: '全部优先级' },
  { value: 'urgent', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'normal', label: '普通' },
  { value: 'low', label: '低' },
];

interface ProgressToolbarProps {
  workshops: Array<{ id: string; name: string; code: string }>;
  filter: ProgressFilter;
  onFilterChange: (filter: ProgressFilter) => void;
}

export function ProgressToolbar({ workshops, filter, onFilterChange }: ProgressToolbarProps) {
  const [localKeyword, setLocalKeyword] = useState(filter.keyword);

  const updateFilter = useCallback(
    (patch: Partial<ProgressFilter>) => {
      onFilterChange({ ...filter, ...patch });
    },
    [filter, onFilterChange]
  );

  const handleSearch = useCallback(() => {
    updateFilter({ keyword: localKeyword });
  }, [localKeyword, updateFilter]);

  const handleReset = useCallback(() => {
    setLocalKeyword('');
    onFilterChange({ keyword: '', status: 'all', workshop_id: 'all', priority: 'all' });
  }, [onFilterChange]);

  const activeFilterCount = [
    filter.keyword,
    filter.status !== 'all',
    filter.workshop_id !== 'all',
    filter.priority !== 'all',
  ].filter(Boolean).length;

  const removeFilter = useCallback(
    (key: keyof ProgressFilter) => {
      if (key === 'keyword') {
        setLocalKeyword('');
        updateFilter({ keyword: '' });
      } else {
        updateFilter({ [key]: 'all' });
      }
    },
    [updateFilter]
  );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索工单号/产品/客户..."
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            onBlur={() => localKeyword !== filter.keyword && handleSearch()}
            className="pl-9 h-9"
          />
          {localKeyword && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setLocalKeyword('');
                updateFilter({ keyword: '' });
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <Select value={filter.status} onValueChange={(v) => updateFilter({ status: v })}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Workshop filter */}
        <Select value={filter.workshop_id} onValueChange={(v) => updateFilter({ workshop_id: v })}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="车间" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部车间</SelectItem>
            {workshops.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority filter */}
        <Select value={filter.priority} onValueChange={(v) => updateFilter({ priority: v })}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder="优先级" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset */}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-9 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            重置
          </Button>
        )}
      </div>

      {/* Active filter tags */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
          {filter.keyword && (
            <Badge variant="secondary" className="text-xs gap-1 pr-1">
              关键词: {filter.keyword}
              <button onClick={() => removeFilter('keyword')} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filter.status !== 'all' && (
            <Badge variant="secondary" className="text-xs gap-1 pr-1">
              {statusOptions.find((o) => o.value === filter.status)?.label}
              <button onClick={() => removeFilter('status')} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filter.workshop_id !== 'all' && (
            <Badge variant="secondary" className="text-xs gap-1 pr-1">
              {workshops.find((w) => w.id === filter.workshop_id)?.name || '车间'}
              <button onClick={() => removeFilter('workshop_id')} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filter.priority !== 'all' && (
            <Badge variant="secondary" className="text-xs gap-1 pr-1">
              {priorityOptions.find((o) => o.value === filter.priority)?.label}
              <button onClick={() => removeFilter('priority')} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
