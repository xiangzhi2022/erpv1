'use client';

import { useState, useEffect, useCallback } from 'react';
import { Worker, WorkerStats } from './schemas';
import { StatsCards } from './components/stats-cards';
import { WorkerToolbar } from './components/worker-toolbar';
import { WorkerTable } from './components/worker-table';
import { WorkerFormModal } from './components/worker-form-modal';
import { WorkerDetailDialog } from './components/worker-detail-dialog';
import { DeleteConfirmDialog } from './components/delete-confirm-dialog';
import { CraftDistribution } from './components/craft-distribution';
import { toast } from 'sonner';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [craftType, setCraftType] = useState('');
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState<WorkerStats | null>(null);

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [detailWorker, setDetailWorker] = useState<Worker | null>(null);
  const [deleteWorker, setDeleteWorker] = useState<Worker | null>(null);

  const fetchWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (keyword) params.set('keyword', keyword);
      if (craftType) params.set('craft_type', craftType);
      if (status) params.set('status', status);

      const res = await fetch(`/api/workers?${params}`);
      const data = await res.json();
      if (data.success) {
        setWorkers(data.workers);
        setTotal(data.total);
      } else {
        toast.error(data.error || '获取工人列表失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, craftType, status]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/workers/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleCreate = () => {
    setEditWorker(null);
    setFormOpen(true);
  };

  const handleEdit = (worker: Worker) => {
    setEditWorker(worker);
    setFormOpen(true);
  };

  const handleDetail = (worker: Worker) => {
    setDetailWorker(worker);
  };

  const handleDelete = (worker: Worker) => {
    setDeleteWorker(worker);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditWorker(null);
    fetchWorkers();
    fetchStats();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteWorker) return;
    try {
      const res = await fetch(`/api/workers/${deleteWorker.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('删除成功');
        setDeleteWorker(null);
        fetchWorkers();
        fetchStats();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      {stats && <StatsCards stats={stats} />}

      {/* 工具栏 */}
      <WorkerToolbar
        keyword={keyword}
        onKeywordChange={setKeyword}
        craftType={craftType}
        onCraftTypeChange={setCraftType}
        status={status}
        onStatusChange={setStatus}
        onCreate={handleCreate}
      />

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 工人列表 */}
        <div className="lg:col-span-3">
          <WorkerTable
            workers={workers}
            loading={loading}
            onEdit={handleEdit}
            onDetail={handleDetail}
            onDelete={handleDelete}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            total={total}
          />
        </div>

        {/* 工种分布 */}
        <div className="lg:col-span-1">
          {stats && <CraftDistribution distribution={stats.craftDistribution} />}
        </div>
      </div>

      {/* 表单弹窗 */}
      <WorkerFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        editWorker={editWorker}
        onSuccess={handleFormSuccess}
      />

      {/* 详情弹窗 */}
      <WorkerDetailDialog
        worker={detailWorker}
        open={!!detailWorker}
        onOpenChange={(open: boolean) => { if (!open) setDetailWorker(null); }}
      />

      {/* 删除确认 */}
      <DeleteConfirmDialog
        worker={deleteWorker}
        open={!!deleteWorker}
        onOpenChange={(open: boolean) => { if (!open) setDeleteWorker(null); }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
