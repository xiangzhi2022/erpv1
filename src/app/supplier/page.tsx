'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';
import { toast } from 'sonner';
import { SupplierTable } from './components/supplier-table';
import { SupplierToolbar } from './components/supplier-toolbar';
import { SupplierFormModal } from './components/supplier-form-modal';
import { SupplierDetailDialog } from './components/supplier-detail-dialog';
import { StatusChangeDialog } from './components/status-change-dialog';
import { DeleteConfirmDialog } from './components/delete-confirm-dialog';
import type { Supplier, SupplierFormValues } from './schemas';

export default function SupplierPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // 筛选状态
  const [filters, setFilters] = useState<{ keyword?: string; category?: string; rating?: string; status?: string }>({});

  // 弹窗状态
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // 当前操作对象
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);

  // 获取供应商列表
  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.keyword) params.set('keyword', filters.keyword);
      if (filters.category) params.set('category', filters.category);
      if (filters.rating) params.set('rating', filters.rating);
      if (filters.status) params.set('status', filters.status);

      const res = await fetch(`/api/supplier/list?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.data || []);
      } else {
        toast.error('获取供应商列表失败');
      }
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // 搜索处理
  const handleSearch = (keyword: string) => {
    setFilters((prev) => ({ ...prev, keyword }));
  };

  // 筛选变化处理
  const handleFilterChange = (newFilters: { category?: string; rating?: string; status?: string }) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // 新增供应商
  const handleCreate = () => {
    setCurrentSupplier(null);
    setFormOpen(true);
  };

  // 查看详情
  const handleView = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setDetailOpen(true);
  };

  // 编辑供应商
  const handleEdit = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setFormOpen(true);
  };

  // 变更状态
  const handleStatusChange = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setStatusOpen(true);
  };

  // 删除
  const handleDelete = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setDeleteOpen(true);
  };

  // 表单提交
  const handleFormSubmit = async (values: Record<string, unknown>) => {
    try {
      setActionLoading(true);
      if (currentSupplier) {
        // 编辑
        const res = await fetch('/api/supplier/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentSupplier.id, ...values }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('供应商信息已更新');
          setFormOpen(false);
          fetchSuppliers();
        } else {
          toast.error(data.error || '更新失败');
        }
      } else {
        // 新增
        const res = await fetch('/api/supplier/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        const data = await res.json();
        if (data.success) {
          toast.success('供应商创建成功');
          setFormOpen(false);
          fetchSuppliers();
        } else {
          toast.error(data.error || '创建失败');
        }
      }
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  // 状态变更确认
  const handleStatusConfirm = async (supplierId: string, newStatus: string) => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/supplier/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: supplierId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('状态已变更');
        setStatusOpen(false);
        fetchSuppliers();
      } else {
        toast.error(data.error || '状态变更失败');
      }
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  // 删除确认
  const handleDeleteConfirm = async () => {
    if (!currentSupplier) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/supplier/delete?id=${currentSupplier.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('供应商已删除');
        setDeleteOpen(false);
        fetchSuppliers();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  // 统计数据
  const stats = {
    total: suppliers.length,
    active: suppliers.filter((s) => s.status === 'active').length,
    inspecting: suppliers.filter((s) => s.status === 'inspecting').length,
    blacklisted: suppliers.filter((s) => s.status === 'blacklisted').length,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 p-6 ml-64">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">供应商管理</h1>
          <p className="text-muted-foreground mt-1">维护上游合作伙伴档案与资质评级</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">总供应商</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">活跃合作</div>
            <div className="text-2xl font-bold mt-1 text-emerald-600">{stats.active}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">考察中</div>
            <div className="text-2xl font-bold mt-1 text-amber-600">{stats.inspecting}</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">已拉黑</div>
            <div className="text-2xl font-bold mt-1 text-gray-500">{stats.blacklisted}</div>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="mb-4">
          <SupplierToolbar
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            onCreateClick={handleCreate}
          />
        </div>

        {/* 数据表格 */}
        {loading ? (
          <div className="rounded-md border">
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SupplierTable
            data={suppliers}
            onEdit={handleEdit}
            onView={handleView}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        )}

        {/* 弹窗集合 */}
        <SupplierFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          supplier={currentSupplier}
          onSubmit={handleFormSubmit}
          loading={actionLoading}
        />

        <SupplierDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          supplier={currentSupplier}
          onEdit={handleEdit}
        />

        <StatusChangeDialog
          open={statusOpen}
          onOpenChange={setStatusOpen}
          supplier={currentSupplier}
          onConfirm={handleStatusConfirm}
          loading={actionLoading}
        />

        <DeleteConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          supplier={currentSupplier}
          onConfirm={handleDeleteConfirm}
          loading={actionLoading}
        />
      </main>
    </div>
  );
}
