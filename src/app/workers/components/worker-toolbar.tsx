'use client';

import { CRAFT_TYPES, WORKER_STATUSES } from '../schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';

interface WorkerToolbarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  craftType: string;
  onCraftTypeChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onCreate: () => void;
}

export function WorkerToolbar({
  keyword,
  onKeywordChange,
  craftType,
  onCraftTypeChange,
  status,
  onStatusChange,
  onCreate,
}: WorkerToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-3 flex-1">
        {/* 搜索 */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索姓名/工号..."
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 工种筛选 */}
        <Select value={craftType} onValueChange={(v) => onCraftTypeChange(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="全部工种" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部工种</SelectItem>
            {CRAFT_TYPES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 状态筛选 */}
        <Select value={status} onValueChange={(v) => onStatusChange(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {WORKER_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={onCreate}>
        <Plus className="h-4 w-4 mr-1" />
        新增工人
      </Button>
    </div>
  );
}
