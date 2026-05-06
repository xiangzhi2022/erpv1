'use client';

import { useState, useCallback, Suspense } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DealerTable } from './components/dealer-table';
import { DealerSearch } from './components/dealer-search';
import { DealerFormModal } from './components/dealer-form';
import type { Dealer } from './schemas';

function DealerPageContent() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEdit = useCallback((dealer: Dealer) => {
    setEditingDealer(dealer);
    setFormOpen(true);
  }, []);

  const handleAdd = useCallback(() => {
    setEditingDealer(null);
    setFormOpen(true);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">经销商管理</h1>
            <p className="text-sm text-muted-foreground mt-1">管理经销商信息、联系方式和状态</p>
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
          onSuccess={handleFormSuccess}
        />
      </main>
    </div>
  );
}

export default function DealerPage() {
  return (
    <Suspense>
      <DealerPageContent />
    </Suspense>
  );
}
