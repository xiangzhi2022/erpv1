'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Truck, ShieldCheck, ShieldAlert, UserCheck, Clock } from 'lucide-react';
import { SupplierToolbar } from './components/supplier-toolbar';
import { SupplierTable } from './components/supplier-table';
import { SupplierFormModal } from './components/supplier-form-modal';
import { StatusChangeDialog } from './components/status-change-dialog';
import { SupplierDetailDialog } from './components/supplier-detail-dialog';
import { DeleteConfirmDialog } from './components/delete-confirm-dialog';
import type { Supplier } from './schemas';

interface SupplierStats {
  total: number;
  active: number;
  inspecting: number;
  blacklisted: number;
  ratingA: number;
}

export default function SupplierPage() {

  // 数据状态
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SupplierStats>({
    total: 0,
    active: 0,
    inspecting: 0,
    blacklisted: 0,
    ratingA: 0,
  });

  // 筛选状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filters, setFilters] = useState<{
    category?: string;
    rating?: string;
    status?: string;
  }>({});

  // 弹窗状态
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [statusChangingSupplier, setStatusChangingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 获取供应商列表
  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchKeyword) params.set('keyword', searchKeyword);
      if (filters.category) params.set('category', filters.category);
      if (filters.rating) params.set('rating', filters.rating);
      if (filters.status) params.set('status', filters.status);

      const res = await fetch(`/api/supplier/list?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSuppliers(data.data || []);
          // 更新统计
          const list: Supplier[] = data.data || [];
          setStats({
            total: list.length,
            active: list.filter((s) => s.status === 'active').length,
            inspecting: list.filter((s) => s.status === 'inspecting').length,
            blacklisted: list.filter((s) => s.status === 'blacklisted').length,
            ratingA: list.filter((s) => s.rating === 'A').length,
          });
        }
      }
    } catch (error) {
      console.error('获取供应商列表失败:', error);
      toast.error('获取数据失败', { description: '无法加载供应商列表，请稍后重试' });
    } finally {
      setLoading(false);
    }
  }, [searchKeyword, filters]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // 新增供应商
  const handleCreate = () => {
    setEditingSupplier(null);
    setFormOpen(true);
  };

  // 编辑供应商
  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormOpen(true);
  };

  // 查看详情
  const handleView = (supplier: Supplier) => {
    setViewingSupplier(supplier);
  };

  // 变更状态
  const handleStatusChange = (supplier: Supplier) => {
    setStatusChangingSupplier(supplier);
  };

  // 删除供应商
  const handleDelete = (supplier: Supplier) => {
    setDeletingSupplier(supplier);
  };

  // 表单提交（新增/编辑）
  const handleFormSubmit = async (values: Record<string, unknown>) => {
    try {
      setSubmitting(true);
      const isEdit = !!editingSupplier;
      const url = isEdit ? '/api/supplier/update' : '/api/supplier/create';
      const body = isEdit ? { id: editingSupplier.id, ...values } : values;

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(isEdit ? '更新成功' : '创建成功', {
          description: isEdit ? '供应商信息已更新' : `供应商 ${values.name as string} 已创建`,
        });
        setFormOpen(false);
        setEditingSupplier(null);
        fetchSuppliers();
      } else {
        toast.error(isEdit ? '更新失败' : '创建失败', {
          description: data.error || '操作失败，请重试',
        });
      }
    } catch (error) {
      console.error('提交供应商失败:', error);
      toast.error('提交失败', { description: '网络错误，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  // 状态变更确认
  const handleStatusConfirm = async (supplierId: string, newStatus: string) => {
    try {
      setSubmitting(true);
      const res = await fetch('/api/supplier/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: supplierId, status: newStatus }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('状态已变更', { description: '供应商合作状态已更新' });
        setStatusChangingSupplier(null);
        fetchSuppliers();
      } else {
        toast.error('变更失败', { description: data.error || '状态变更失败' });
      }
    } catch (error) {
      console.error('变更状态失败:', error);
      toast.error('变更失败', { description: '网络错误，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  // 删除确认
  const handleDeleteConfirm = async () => {
    if (!deletingSupplier) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/supplier/delete?id=${deletingSupplier.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('删除成功', { description: `供应商 ${deletingSupplier.name} 已删除` });
        setDeletingSupplier(null);
        fetchSuppliers();
      } else {
        toast.error('删除失败', { description: data.error || '删除失败' });
      }
    } catch (error) {
      console.error('删除供应商失败:', error);
      toast.error('删除失败', { description: '网络错误，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  // 从详情弹窗跳转编辑
  const handleEditFromDetail = (supplier: Supplier) => {
    setViewingSupplier(null);
    setTimeout(() => {
      handleEdit(supplier);
    }, 200);
  };

  return (
    <>
        {/* 页面标题 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">供应商管理</h1>
            <p className="text-muted-foreground mt-1">维护上游合作伙伴档案与资质评级</p>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">供应商总数</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">活跃合作</CardTitle>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">考察中</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.inspecting}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">已拉黑</CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.blacklisted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">A级供应商</CardTitle>
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.ratingA}</div>
            </CardContent>
          </Card>
        </div>

        {/* 工具栏 */}
        <SupplierToolbar
          onSearch={setSearchKeyword}
          onFilterChange={setFilters}
          onCreateClick={handleCreate}
        />

        {/* 数据表格 */}
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                加载中...
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
        </div>

        {/* 弹窗组件 */}
        <SupplierFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          supplier={editingSupplier}
          onSubmit={handleFormSubmit}
          loading={submitting}
        />

        <SupplierDetailDialog
          open={!!viewingSupplier}
          onOpenChange={(open) => !open && setViewingSupplier(null)}
          supplier={viewingSupplier}
          onEdit={handleEditFromDetail}
        />

        <StatusChangeDialog
          open={!!statusChangingSupplier}
          onOpenChange={(open) => !open && setStatusChangingSupplier(null)}
          supplier={statusChangingSupplier}
          onConfirm={handleStatusConfirm}
          loading={submitting}
        />

        <DeleteConfirmDialog
          open={!!deletingSupplier}
          onOpenChange={(open) => !open && setDeletingSupplier(null)}
          supplier={deletingSupplier}
          onConfirm={handleDeleteConfirm}
          loading={submitting}
        />
      </>
  );
}
