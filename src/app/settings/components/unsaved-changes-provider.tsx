'use client';

import React, { useCallback, useContext, useState } from 'react';
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

interface UnsavedChangesContextType {
  setDirty: (dirty: boolean) => void;
}

const UnsavedChangesContext = React.createContext<UnsavedChangesContextType>({
  setDirty: () => {},
});

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [, setIsDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const setDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    setShowDialog(false);
    setIsDirty(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  const handleCancelLeave = useCallback(() => {
    setShowDialog(false);
    setPendingNavigation(null);
  }, []);

  return (
    <UnsavedChangesContext.Provider value={{ setDirty }}>
      {children}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>未保存的更改</AlertDialogTitle>
            <AlertDialogDescription>
              您有未保存的更改，离开此页面将丢失这些更改。确定要离开吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelLeave}>留在当前页</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave}>放弃更改</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}
