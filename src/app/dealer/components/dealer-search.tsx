'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, RotateCcw } from 'lucide-react';

export function DealerSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');

  const applyFilters = useCallback(
    (newKeyword?: string, newStatus?: string) => {
      const kw = newKeyword !== undefined ? newKeyword : keyword;
      const st = newStatus !== undefined ? newStatus : status;

      const params = new URLSearchParams();
      params.set('page', '1');
      if (kw) params.set('keyword', kw);
      if (st && st !== 'all') params.set('status', st);

      router.push(`/dealer?${params.toString()}`);
    },
    [keyword, status, router]
  );

  const handleSearch = useCallback(() => {
    applyFilters();
  }, [applyFilters]);

  const handleReset = useCallback(() => {
    setKeyword('');
    setStatus('all');
    router.push('/dealer');
  }, [router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatus(value);
      applyFilters(keyword, value);
    },
    [keyword, applyFilters]
  );

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <Input
        placeholder="搜索经销商名称/联系人/电话"
        className="w-full sm:w-[260px]"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Select value={status} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="状态筛选" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          <SelectItem value="active">启用</SelectItem>
          <SelectItem value="inactive">停用</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleSearch}>
          <Search className="mr-1 h-4 w-4" />
          搜索
        </Button>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="mr-1 h-4 w-4" />
          重置
        </Button>
      </div>
    </div>
  );
}
