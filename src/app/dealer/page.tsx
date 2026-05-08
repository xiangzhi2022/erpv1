'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DealerTable } from './components/dealer-table';
import { DealerSearch } from './components/dealer-search';
import { DealerFormModal } from './components/dealer-form';
import type { Dealer } from './schemas';

export default function DealerPage() {
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">经销商管理</h1>
            <p className="text-muted-foreground mt-1">管理经销商信息、联系方式与状态</p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            新增经销商
          </Button>
        </div>

        {/* 搜索过滤栏 */}
        <DealerSearch />

        {/* 数据表格 */}
        <DealerTable onEdit={handleEdit} refreshTrigger={refreshTrigger} />

        {/* 新增/编辑弹窗 */}
        <DealerFormModal
          open={formOpen}
          onOpenChange={setFormOpen}
          editingDealer={editingDealer}
          onSuccess={handleSuccess}
        />
      </main>
    </div>
  );
}
