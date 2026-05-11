'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Eye, ShieldBan, Trash2, Phone, Mail } from 'lucide-react';
import type { Supplier } from '../schemas';

interface SupplierTableProps {
  data: Supplier[];
  onEdit: (supplier: Supplier) => void;
  onView: (supplier: Supplier) => void;
  onStatusChange: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

// 评级对应的 Badge 样式
const ratingConfig: Record<string, { label: string; className: string }> = {
  A: { label: 'A级', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  B: { label: 'B级', className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' },
  C: { label: 'C级', className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' },
  D: { label: 'D级', className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100' },
};

// 状态对应的 Badge 样式
const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: '活跃', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  inspecting: { label: '考察中', className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' },
  blacklisted: { label: '已拉黑', className: 'bg-gray-200 text-gray-500 border-gray-300 line-through hover:bg-gray-200' },
};

export function SupplierTable({ data, onEdit, onView, onStatusChange, onDelete }: SupplierTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ShieldBan className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">暂无供应商数据</p>
        <p className="text-sm mt-1">点击右上角&quot;新增供应商&quot;添加</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">编号</TableHead>
            <TableHead className="min-w-[160px]">供应商名称</TableHead>
            <TableHead className="w-24">类别</TableHead>
            <TableHead className="w-24">联系人</TableHead>
            <TableHead className="w-36">联系方式</TableHead>
            <TableHead className="w-20 text-center">评级</TableHead>
            <TableHead className="w-24 text-center">状态</TableHead>
            <TableHead className="w-20 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((supplier) => {
            const rating = ratingConfig[supplier.rating] || ratingConfig['B'];
            const status = statusConfig[supplier.status] || statusConfig['active'];

            return (
              <TableRow key={supplier.id} className={supplier.status === 'blacklisted' ? 'opacity-60' : ''}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {supplier.supplier_code}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{supplier.name}</div>
                  {supplier.address && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">
                      {supplier.address}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {supplier.category || '-'}
                  </Badge>
                </TableCell>
                <TableCell>{supplier.contact_person || '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    {supplier.phone ? (
                      <a
                        href={`tel:${supplier.phone}`}
                        className="flex items-center gap-1 text-xs hover:text-primary transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        {supplier.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                    {supplier.email ? (
                      <a
                        href={`mailto:${supplier.email}`}
                        className="flex items-center gap-1 text-xs hover:text-primary transition-colors truncate"
                      >
                        <Mail className="h-3 w-3 shrink-0" />
                        {supplier.email}
                      </a>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={rating.className}>
                    {rating.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={status.className}>
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => onView(supplier)}>
                        <Eye className="h-4 w-4 mr-2" />
                        查看详情
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(supplier)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        编辑信息
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onStatusChange(supplier)}>
                        <ShieldBan className="h-4 w-4 mr-2" />
                        变更状态
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(supplier)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
