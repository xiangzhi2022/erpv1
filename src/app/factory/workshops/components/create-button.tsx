'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FactoryForm } from './factory-form';
import { Plus, Building2 } from 'lucide-react';

interface CreateFactoryButtonProps {
  onSuccess: () => void;
}

export function CreateFactoryButton({ onSuccess }: CreateFactoryButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus className="h-4 w-4 mr-1.5" />
        新增车间
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              新增车间
            </DialogTitle>
          </DialogHeader>
          <FactoryForm
            onSuccess={() => {
              setOpen(false);
              onSuccess();
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
