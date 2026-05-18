'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, ChevronLeft, ChevronRight, Plus, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DealerTable } from './components/dealer-table';
import { DealerSearch } from './components/dealer-search';
import { DealerFormModal } from './components/dealer-form';
import type { Dealer, Pagination } from './schemas';

interface EnterpriseDirectoryItem {
  id: string;
  name: string | null;
  company_name: string | null;
  tenant_type: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  address: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
}

interface EnterpriseDirectoryResponse {
  success: boolean;
  mode?: 'dealer_management' | 'readonly';
  title?: string;
  description?: string;
  readonly?: boolean;
  targetTenantType?: string;
  data?: EnterpriseDirectoryItem[];
  pagination?: Pagination;
  error?: string;
}

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
};

const tenantTypeLabel: Record<string, string> = {
  manufacturer: '工厂企业',
  material_supplier: '材料供应商',
  dealer: '经销商',
};

const statusLabel: Record<string, { label: string; className: string }> = {
  active: { label: '启用', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  inactive: { label: '停用', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
  disabled: { label: '停用', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' },
};

function enterpriseName(item: EnterpriseDirectoryItem): string {
  return item.company_name || item.name || item.id;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function DealerPage() {
  const [response, setResponse] = useState<EnterpriseDirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  const fetchDirectory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const keyword = searchParams.get('keyword') || '';
      const status = searchParams.get('status') || '';
      const page = searchParams.get('page') || '1';

      params.set('page', page);
      params.set('pageSize', '10');
      if (keyword) params.set('keyword', keyword);
      if (status) params.set('status', status);

      const res = await fetch(`/api/enterprise-directory?${params.toString()}`);
      const data: EnterpriseDirectoryResponse = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || '无法加载企业库');
        setResponse(data);
        return;
      }
      setResponse(data);
    } catch {
      toast.error('无法加载企业库');
      setResponse({ success: false, error: '无法加载企业库' });
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (response?.mode === 'dealer_management') {
    return <DealerManagementContent />;
  }

  if (!response?.success) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        <Building2 className="mx-auto h-10 w-10 opacity-40" />
        <div className="mt-4 text-base font-medium text-foreground">当前账号不显示企业库</div>
        <p className="mt-2 text-sm">材料供应商账号不会看到经销商和工厂企业信息。</p>
      </div>
    );
  }

  return (
    <EnterpriseDirectory
      title={response.title || '企业库'}
      description={response.description || '查看协作企业信息。'}
      data={response.data || []}
      pagination={response.pagination || DEFAULT_PAGINATION}
      router={router}
      searchParams={searchParams}
    />
  );
}

function EnterpriseDirectory({
  title,
  description,
  data,
  pagination,
  router,
  searchParams,
}: {
  title: string;
  description: string;
  data: EnterpriseDirectoryItem[];
  pagination: Pagination;
  router: ReturnType<typeof useRouter>;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');

  const applyFilters = useCallback((nextPage = 1, nextKeyword = keyword, nextStatus = status) => {
    const params = new URLSearchParams();
    params.set('page', String(nextPage));
    if (nextKeyword.trim()) params.set('keyword', nextKeyword.trim());
    if (nextStatus && nextStatus !== 'all') params.set('status', nextStatus);
    router.push(`/dealer?${params.toString()}`);
  }, [keyword, router, status]);

  const resetFilters = () => {
    setKeyword('');
    setStatus('all');
    router.push('/dealer');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="w-fit">只读</Badge>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        当前页面只用于查看协作企业信息，不提供新增、编辑、删除入口。
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="搜索企业名称 / 联系人 / 电话"
          className="w-full sm:w-[300px]"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyFilters();
          }}
        />
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-[140px]"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            applyFilters(1, keyword, event.target.value);
          }}
        >
          <option value="all">全部状态</option>
          <option value="active">启用</option>
          <option value="inactive">停用</option>
          <option value="disabled">停用</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => applyFilters()}>
          <Search className="mr-1 h-4 w-4" />
          搜索
        </Button>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <RotateCcw className="mr-1 h-4 w-4" />
          重置
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <Building2 className="mx-auto h-12 w-12 opacity-30" />
          <p className="mt-4 text-lg font-medium">暂无企业数据</p>
          <p className="mt-1 text-sm">企业注册后会自动出现在这里。</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[220px]">企业名称</TableHead>
                <TableHead className="min-w-[120px]">企业类型</TableHead>
                <TableHead className="min-w-[120px]">联系人</TableHead>
                <TableHead className="min-w-[140px]">联系电话</TableHead>
                <TableHead className="min-w-[220px]">地址</TableHead>
                <TableHead className="w-[100px] text-center">状态</TableHead>
                <TableHead className="min-w-[120px]">注册时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => {
                const status = statusLabel[item.status || ''] || { label: item.status || '-', className: 'bg-gray-100 text-gray-600 hover:bg-gray-100' };
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{enterpriseName(item)}</TableCell>
                    <TableCell>{tenantTypeLabel[item.tenant_type || ''] || item.tenant_type || '-'}</TableCell>
                    <TableCell>{item.contact_person || '-'}</TableCell>
                    <TableCell>{item.contact_phone || '-'}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{item.address || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(item.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between py-2">
        <p className="text-sm text-muted-foreground">
          共 {pagination.total} 条记录，第 {pagination.page}/{Math.max(pagination.totalPages, 1)} 页
        </p>
        {pagination.totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DealerManagementContent() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAdd = () => {
    setEditingDealer(null);
    setFormOpen(true);
  };

  const handleEdit = (dealer: Dealer) => {
    setEditingDealer(dealer);
    setFormOpen(true);
  };

  const handleSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">经销商管理</h1>
          <p className="mt-1 text-muted-foreground">管理经销商信息、联系方式与状态</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          新增经销商
        </Button>
      </div>

      <DealerSearch />
      <DealerTable onEdit={handleEdit} refreshTrigger={refreshTrigger} />

      <DealerFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        editingDealer={editingDealer}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
