'use client';

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
import { useCallback } from 'react';

export function DealerSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSearch = useCallback(() => {
    const keyword = (document.getElementById('dealer-keyword') as HTMLInputElement)?.value || '';
    const status = (document.getElementById('dealer-status') as HTMLSelectElement)?.value || '';

    const params = new URLSearchParams();
    params.set('page', '1');
    if (keyword) params.set('keyword', keyword);
    if (status) params.set('status', status);

    router.push(`/dealer?${params.toString()}`);
  }, [router]);

  const handleReset = useCallback(() => {
    const keywordInput = document.getElementById('dealer-keyword') as HTMLInputElement;
    const statusSelect = document.getElementById('dealer-status') as HTMLSelectElement;
    if (keywordInput) keywordInput.value = '';
    if (statusSelect) statusSelect.value = '';
    router.push('/dealer');
  }, [router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <Input
        id="dealer-keyword"
        placeholder="搜索经销商名称/联系人/电话"
        className="w-full sm:w-[260px]"
        defaultValue={searchParams.get('keyword') || ''}
        onKeyDown={handleKeyDown}
      />
      <Select
        defaultValue={searchParams.get('status') || 'all'}
        onValueChange={(value) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('page', '1');
          if (value && value !== 'all') {
            params.set('status', value);
          } else {
            params.delete('status');
          }
          router.push(`/dealer?${params.toString()}`);
        }}
      >
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
