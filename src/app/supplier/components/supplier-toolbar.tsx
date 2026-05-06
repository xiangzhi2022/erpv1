'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, RotateCcw } from 'lucide-react';
import { supplierCategories, supplierRatings, supplierStatuses } from '../schemas';

interface SupplierToolbarProps {
  onSearch: (keyword: string) => void;
  onFilterChange: (filters: { category?: string; rating?: string; status?: string }) => void;
  onCreateClick: () => void;
}

export function SupplierToolbar({ onSearch, onFilterChange, onCreateClick }: SupplierToolbarProps) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>('');
  const [rating, setRating] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  const handleSearch = () => {
    onSearch(keyword);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCategoryChange = (value: string) => {
    const newCategory = value === '_all' ? '' : value;
    setCategory(newCategory);
    onFilterChange({ category: newCategory, rating, status });
  };

  const handleRatingChange = (value: string) => {
    const newRating = value === '_all' ? '' : value;
    setRating(newRating);
    onFilterChange({ category, rating: newRating, status });
  };

  const handleStatusChange = (value: string) => {
    const newStatus = value === '_all' ? '' : value;
    setStatus(newStatus);
    onFilterChange({ category, rating, status: newStatus });
  };

  const handleReset = () => {
    setKeyword('');
    setCategory('');
    setRating('');
    setStatus('');
    onSearch('');
    onFilterChange({});
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {/* 搜索框 */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索名称/联系人/电话"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>

        {/* 分类筛选 */}
        <Select value={category || '_all'} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="供应类别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">全部类别</SelectItem>
            {supplierCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 评级筛选 */}
        <Select value={rating || '_all'} onValueChange={handleRatingChange}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="评级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">全部评级</SelectItem>
            {supplierRatings.map((r) => (
              <SelectItem key={r} value={r}>{r}级</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 状态筛选 */}
        <Select value={status || '_all'} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">全部状态</SelectItem>
            {supplierStatuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 重置 */}
        <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 gap-1">
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </Button>
      </div>

      {/* 新增按钮 */}
      <Button onClick={onCreateClick} className="gap-2">
        <Plus className="h-4 w-4" />
        新增供应商
      </Button>
    </div>
  );
}
