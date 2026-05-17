'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, CheckCircle, Eye, FileText, MoreHorizontal, RotateCcw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { OrderMode } from '@/lib/order-flow';
import { ORDER_STATUS_CONFIG, type Order, formatAmount, formatDate } from '../schemas';

interface OrderTableProps {
  orders: Order[];
  mode: OrderMode;
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

function counterparty(order: Order, mode: OrderMode): string {
  if (mode === 'dealer' || mode === 'factory_material') {
    return order.to_tenant?.company_name || order.to_tenant?.name || order.customer_name || '-';
  }
  return order.from_tenant?.company_name || order.from_tenant?.name || order.customer_name || '-';
}

function flowLabel(order: Order): string {
  if (order.order_flow === 'dealer_to_factory') return '经销商 -> 工厂';
  if (order.order_flow === 'factory_to_supplier') return '工厂 -> 材料商';
  return '历史订单';
}

function itemSummary(order: Order): string {
  if (order.modules.length > 0) {
    return `${order.modules.length} 个模块 / ${order.items.length} 个明细`;
  }
  if (order.items.length > 0) return `${order.items.length} 个明细`;
  return '-';
}

export function OrderTable({
  orders,
  mode,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  onViewDetail,
  onStatusChange,
}: OrderTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const canReceive = mode === 'factory_received' || mode === 'supplier_received';
  const canAdvanceProduction = mode === 'factory_received';
  const canCancelOutgoing = mode === 'dealer' || mode === 'factory_material';

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => (
      prev.size === orders.length ? new Set() : new Set(orders.map((order) => order.id))
    ));
  };

  const statusBadge = (status: string) => {
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    if (!config) return <Badge variant="secondary">{status}</Badge>;
    return (
      <Badge variant="outline" className={`${config.color} border font-medium`}>
        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileText className="mb-4 h-16 w-16 opacity-30" />
        <p className="text-lg font-medium">暂无订单数据</p>
        <p className="mt-1 text-sm">当前订单模块还没有可显示的订单</p>
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
                <Checkbox checked={selectedIds.size === orders.length && orders.length > 0} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead className="font-semibold">订单编号</TableHead>
              <TableHead className="font-semibold">流向</TableHead>
              <TableHead className="font-semibold">对方企业</TableHead>
              <TableHead className="font-semibold">模块/明细</TableHead>
              <TableHead className="font-semibold">总金额</TableHead>
              <TableHead className="font-semibold">状态</TableHead>
              <TableHead className="font-semibold">创建时间</TableHead>
              <TableHead className="font-semibold">交付日期</TableHead>
              <TableHead className="w-12 text-right font-semibold">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="cursor-pointer hover:bg-muted/30" data-state={selectedIds.has(order.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                </TableCell>
                <TableCell>
                  <Link href={`/orders/${order.id}`} className="font-mono text-sm text-primary hover:underline">
                    {order.order_no}
                  </Link>
                  {order.parent_order ? (
                    <div className="mt-1 text-xs text-muted-foreground">关联 {order.parent_order.order_no}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{flowLabel(order)}</Badge>
                </TableCell>
                <TableCell className="font-medium">{counterparty(order, mode)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{itemSummary(order)}</TableCell>
                <TableCell className="font-mono text-sm">¥{formatAmount(order.total_amount)}</TableCell>
                <TableCell>{statusBadge(order.status)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(order.created_at)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{order.delivery_date ? order.delivery_date.split('T')[0] : '-'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/orders/${order.id}`}>
                          <Eye className="mr-2 h-4 w-4" /> 查看订单树
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewDetail(order)}>
                        <FileText className="mr-2 h-4 w-4" /> 快速预览
                      </DropdownMenuItem>
                      {order.status === 'pending' && canReceive ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onStatusChange(order.id, 'confirmed')}>
                            <CheckCircle className="mr-2 h-4 w-4" /> 接收订单
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(order.id, 'returned')} className="text-destructive">
                            <RotateCcw className="mr-2 h-4 w-4" /> 退回订单
                          </DropdownMenuItem>
                        </>
                      ) : null}
                      {order.status === 'confirmed' && canAdvanceProduction ? (
                        <DropdownMenuItem onClick={() => onStatusChange(order.id, 'pool')}>
                          <ArrowRight className="mr-2 h-4 w-4" /> 入订单池
                        </DropdownMenuItem>
                      ) : null}
                      {canCancelOutgoing && (order.status === 'pending' || order.status === 'confirmed') ? (
                        <DropdownMenuItem onClick={() => onStatusChange(order.id, 'cancelled')} className="text-destructive">
                          <XCircle className="mr-2 h-4 w-4" /> 取消订单
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>共 {pagination.total} 条</span>
          <Select value={String(pagination.pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-[76px]">
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
        {pagination.totalPages > 1 ? (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
                  className={pagination.page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {generatePageNumbers(pagination.page, pagination.totalPages).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink onClick={() => onPageChange(page)} isActive={page === pagination.page} className="cursor-pointer">
                    {page}
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
        ) : null}
      </div>
    </div>
  );
}

function generatePageNumbers(current: number, total: number): number[] {
  const pages: number[] = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total, current + 2);
  for (let page = start; page <= end; page += 1) pages.push(page);
  return pages;
}
