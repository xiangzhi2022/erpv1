'use client';

import { useState, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DraggableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function DraggableDialog({ 
  open, 
  onOpenChange, 
  title, 
  description, 
  children,
  className = '' 
}: DraggableDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isFirstOpen, setIsFirstOpen] = useState(true);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 只在标题栏区域拖拽
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      setIsDragging(true);
      if (dialogRef.current) {
        const rect = dialogRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && dialogRef.current) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setIsFirstOpen(false);
      setPosition({ x: 0, y: 0 });
    }
    onOpenChange(newOpen);
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={() => handleOpenChange(false)}
      />
      
      {/* 可拖拽对话框 */}
      <div
        ref={dialogRef}
        className={`relative bg-background rounded-lg shadow-lg border w-full max-w-md ${className}`}
        style={{
          transform: isFirstOpen ? 'none' : `translate(${position.x}px, ${position.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 标题栏 - 可拖拽 */}
        <div 
          className="flex items-center justify-between p-4 border-b cursor-move select-none"
          data-drag-handle
        >
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            onClick={() => handleOpenChange(false)}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">关闭</span>
          </button>
        </div>
        
        {/* 内容 */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
