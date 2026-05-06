'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal, Eye, RotateCcw, CheckCircle, XCircle, ArrowRight, FileText } from 'lucide-react';
import { Order, ORDER_STATUS_CONFIG, formatAmount, formatDate } from '../schemas';

interface OrderTableProps {
  orders: Order[];
  loading: boolean;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onViewDetail: (order: Order) => void;
  onStatusChange: (orderId: string, status: string, notes?: string) => void;
}

export function OrderTable({
  orders,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  onViewDetail,
  onStatusChange,
}: OrderTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    const cfg = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    if (!cfg) return <Badge variant="secondary">{status}</Badge>;
    return (
      <Badge variant="outline" className={`${cfg.color} border font-medium`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor} mr-1.5`} />
        {cfg.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileText className="h-16 w-16 mb-4 opacity-30" />
        <p className="text-lg font-medium">暂无订单数据</p>
        <p className="text-sm mt-1">点击右上角「创建订单」添加新订单</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === orders.length && orders.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="font-semibold">订单编号</TableHead>
              <TableHead className="font-semibold">客户名称</TableHead>
              <TableHead className="font-semibold">产品明细</TableHead>
              <TableHead className="font-semibold">总金额</TableHead>
              <TableHead className="font-semibold">状态</TableHead>
              <TableHead className="font-semibold">创建时间</TableHead>
              <TableHead className="font-semibold">交付日期</TableHead>
              <TableHead className="w-12 text-right font-semibold">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-muted/30"
                data-state={selectedIds.has(order.id) ? 'selected' : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(order.id)}
                    onCheckedChange={() => toggleSelect(order.id)}
                  />
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => onViewDetail(order)}
                    className="font-mono text-sm text-primary hover:underline"
                  >
                    {order.order_no}
                  </button>
                </TableCell>
                <TableCell className="font-medium">{order.customer_name || '-'}</TableCell>
                <TableCell>
                  {order.items && order.items.length > 0 ? (
                    <div className="max-w-[200px]">
                      <p className="truncate text-sm">
                        {order.items.map((item) => item.product_name).join('、')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        共 {order.items.length} 项
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  ¥{formatAmount(order.total_amount)}
                </TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(order.created_at)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {order.delivery_date ? order.delivery_date.split('T')[0] : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetail(order)}>
                        <Eye className="h-4 w-4 mr-2" /> 查看详情
                      </DropdownMenuItem>
                      {order.status === 'pending' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onStatusChange(order.id, 'confirmed')}>
                            <CheckCircle className="h-4 w-4 mr-2" /> 接收订单
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(order.id, 'returned')} className="text-destructive">
                            <RotateCcw className="h-4 w-4 mr-2" /> 退回订单
                          </DropdownMenuItem>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <DropdownMenuItem onClick={() => onStatusChange(order.id, 'pool')}>
                          <ArrowRight className="h-4 w-4 mr-2" /> 入订单池
                        </DropdownMenuItem>
                      )}
                      {(order.status === 'pending' || order.status === 'confirmed') && (
                        <DropdownMenuItem onClick={() => onStatusChange(order.id, 'cancelled')} className="text-destructive">
                          <XCircle className="h-4 w-4 mr-2" /> 取消订单
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>共 {pagination.total} 条</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span>条/页</span>
        </div>
        {pagination.totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
                  className={pagination.page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {generatePageNumbers(pagination.page, pagination.totalPages).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    onClick={() => onPageChange(p)}
                    isActive={p === pagination.page}
                    className="cursor-pointer"
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                  className={pagination.page >= pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}

function generatePageNumbers(current: number, total: number): number[] {
  const pages: number[] = [];
  const delta = 2;
  const start = Math.max(1, current - delta);
  const end = Math.min(total, current + delta);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
}
