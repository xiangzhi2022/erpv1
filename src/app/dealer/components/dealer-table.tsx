'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight, Store } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { Dealer, DealerListResponse, Pagination } from '../schemas';

interface DealerTableProps {
  onEdit: (dealer: Dealer) => void;
  refreshTrigger: number;
}

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  active: {
    label: '启用',
    variant: 'default',
    className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  },
  inactive: {
    label: '停用',
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-500 hover:bg-gray-100',
  },
};

export function DealerTable({ onEdit, refreshTrigger }: DealerTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Dealer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDealers = useCallback(async () => {
    try {
      setLoading(true);
      const keyword = searchParams.get('keyword') || '';
      const region = searchParams.get('region') || '';
      const status = searchParams.get('status') || '';
      const page = parseInt(searchParams.get('page') || '1', 10);

      const params = new URLSearchParams({
        page: String(page),
        pageSize: '10',
      });
      if (keyword) params.set('keyword', keyword);
      if (region) params.set('region', region);
      if (status) params.set('status', status);

      const res = await fetch(`/api/dealer?${params.toString()}`);
      if (res.ok) {
        const result: DealerListResponse = await res.json();
        setDealers(result.data || []);
        setPagination(result.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 0 });
      }
    } catch (error) {
      console.error('获取经销商列表失败:', error);
      toast.error('获取经销商列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchDealers();
  }, [fetchDealers, refreshTrigger]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/dealer/${deleteTarget.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('删除成功');
        setDeleteTarget(null);
        fetchDealers();
      } else {
        toast.error(result.error || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`/dealer?${params.toString()}`);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (dealers.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Store className="mx-auto h-12 w-12 opacity-30" />
        <p className="mt-4 text-lg font-medium">暂无经销商数据</p>
        <p className="mt-1 text-sm">点击右上角「新增经销商」添加第一条记录</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center">序号</TableHead>
              <TableHead className="min-w-[180px]">经销商名称</TableHead>
              <TableHead className="min-w-[100px]">联系人</TableHead>
              <TableHead className="min-w-[130px]">联系电话</TableHead>
              <TableHead className="min-w-[130px]">所在地区</TableHead>
              <TableHead className="w-[80px] text-center">状态</TableHead>
              <TableHead className="min-w-[110px]">创建时间</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dealers.map((dealer, index) => {
              const st = statusConfig[dealer.status] || statusConfig.inactive;
              return (
                <TableRow key={dealer.id}>
                  <TableCell className="text-center text-muted-foreground">
                    {(pagination.page - 1) * pagination.pageSize + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{dealer.name}</TableCell>
                  <TableCell>{dealer.contact_name || '-'}</TableCell>
                  <TableCell>{dealer.phone || '-'}</TableCell>
                  <TableCell>{dealer.region || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={st.variant} className={st.className}>
                      {st.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(dealer.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(dealer)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(dealer)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* 分页 */}
      <div className="flex items-center justify-between py-4">
        <p className="text-sm text-muted-foreground">
          共 {pagination.total} 条记录，第 {pagination.page}/{Math.max(pagination.totalPages, 1)} 页
        </p>
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除经销商「{deleteTarget?.name}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
