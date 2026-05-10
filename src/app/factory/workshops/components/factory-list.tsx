'use client';

import { useState } from 'react';
import { WorkshopData } from '../schemas';
import { getWorkshopStatusConfig } from '../page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FactoryForm } from './factory-form';
import {
  Building2,
  MapPin,
  User,
  Gauge,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  Wrench,
  OctagonX,
  Loader2,
  Eye,
} from 'lucide-react';

interface FactoryListProps {
  data: WorkshopData[];
  viewMode: 'card' | 'table';
  onStatusToggle: (id: string, newStatus: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
  onEditSuccess: () => void;
}

function StatusBadge({ status }: { status: WorkshopData['status'] }) {
  const config = getWorkshopStatusConfig(status);
  return (
    <Badge
      variant="outline"
      className={`${config.bgColor} ${config.textColor} ${config.borderColor} border font-medium gap-1`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.color}`} />
      {config.label}
    </Badge>
  );
}

function LoadProgress({ value, capacity, load }: { value: number; capacity: number; load: number }) {
  const barClass = value >= 90
    ? '[&>div]:bg-red-500'
    : value >= 70
      ? '[&>div]:bg-amber-500'
      : '[&>div]:bg-emerald-500';

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">
          {load.toLocaleString()} / {capacity.toLocaleString()}
        </span>
        <span className={`font-semibold ${value >= 90 ? 'text-red-600' : value >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
          {value}%
        </span>
      </div>
      <Progress value={value} className={`h-2 ${barClass}`} />
    </div>
  );
}

function WorkshopCard({
  workshop,
  onStatusToggle,
  onDelete,
  isPending,
  onEditSuccess,
}: {
  workshop: WorkshopData;
  onStatusToggle: (id: string, newStatus: string) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
  onEditSuccess: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const config = getWorkshopStatusConfig(workshop.status);

  const nextStatusOptions: { status: string; label: string; icon: React.ReactNode }[] = [];
  if (workshop.status !== 'normal') {
    nextStatusOptions.push({ status: 'normal', label: '恢复运行', icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> });
  }
  if (workshop.status !== 'maintenance') {
    nextStatusOptions.push({ status: 'maintenance', label: '标记检修', icon: <Wrench className="h-3.5 w-3.5 text-amber-600" /> });
  }
  if (workshop.status !== 'stopped') {
    nextStatusOptions.push({ status: 'stopped', label: '标记停工', icon: <OctagonX className="h-3.5 w-3.5 text-red-600" /> });
  }

  return (
    <>
      <Card className={`group shadow-sm hover:shadow-md transition-all duration-200 border-l-4 ${workshop.status === 'normal' ? 'border-l-emerald-500' : workshop.status === 'maintenance' ? 'border-l-amber-500' : 'border-l-red-500'}`}>
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-10 w-10 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0`}>
                <Building2 className={`h-5 w-5 ${config.textColor}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base truncate">{workshop.name}</h3>
                  <StatusBadge status={workshop.status} />
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {workshop.factory_code}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  编辑信息
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {nextStatusOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.status}
                    onClick={() => onStatusToggle(workshop.id, opt.status)}
                    disabled={isPending}
                  >
                    {opt.icon}
                    <span className="ml-2">{opt.label}</span>
                    {isPending && <Loader2 className="h-3 w-3 ml-auto animate-spin" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      删除车间
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除车间</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除「{workshop.name}」({workshop.factory_code}) 吗？此操作不可撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => onDelete(workshop.id)}
                      >
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Info Row */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 text-sm">
            {workshop.location && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{workshop.location}</span>
              </div>
            )}
            {workshop.manager && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{workshop.manager}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Gauge className="h-3.5 w-3.5 shrink-0" />
              <span>日产能 {workshop.capacity.toLocaleString()}</span>
            </div>
          </div>

          {/* Progress */}
          <LoadProgress
            value={workshop.load_percentage}
            capacity={workshop.capacity}
            load={workshop.current_load}
          />

          {/* Description */}
          {workshop.description && (
            <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
              {workshop.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>编辑车间信息</DialogTitle>
          </DialogHeader>
          <FactoryForm
            workshop={workshop}
            onSuccess={() => {
              setEditOpen(false);
              onEditSuccess();
            }}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function WorkshopTable({
  data,
  onStatusToggle,
  onDelete,
  isPending,
}: FactoryListProps) {
  const [detailWorkshop, setDetailWorkshop] = useState<WorkshopData | null>(null);

  return (
    <>
      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[140px]">编号</TableHead>
              <TableHead>车间名称</TableHead>
              <TableHead className="w-[100px]">位置</TableHead>
              <TableHead className="w-[80px]">负责人</TableHead>
              <TableHead className="w-[90px]">状态</TableHead>
              <TableHead className="w-[200px]">产能负荷</TableHead>
              <TableHead className="w-[80px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  暂无车间数据
                </TableCell>
              </TableRow>
            ) : (
              data.map((workshop) => (
                <TableRow key={workshop.id} className="group">
                  <TableCell className="font-mono text-xs">{workshop.factory_code}</TableCell>
                  <TableCell className="font-medium">{workshop.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{workshop.location || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{workshop.manager || '-'}</TableCell>
                  <TableCell>
                    <StatusBadge status={workshop.status} />
                  </TableCell>
                  <TableCell>
                    <LoadProgress
                      value={workshop.load_percentage}
                      capacity={workshop.capacity}
                      load={workshop.current_load}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDetailWorkshop(workshop)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          {workshop.status !== 'normal' && (
                            <DropdownMenuItem onClick={() => onStatusToggle(workshop.id, 'normal')} disabled={isPending}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                              恢复运行
                            </DropdownMenuItem>
                          )}
                          {workshop.status !== 'maintenance' && (
                            <DropdownMenuItem onClick={() => onStatusToggle(workshop.id, 'maintenance')} disabled={isPending}>
                              <Wrench className="h-3.5 w-3.5 mr-2 text-amber-600" />
                              标记检修
                            </DropdownMenuItem>
                          )}
                          {workshop.status !== 'stopped' && (
                            <DropdownMenuItem onClick={() => onStatusToggle(workshop.id, 'stopped')} disabled={isPending}>
                              <OctagonX className="h-3.5 w-3.5 mr-2 text-red-600" />
                              标记停工
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定删除「{workshop.name}」？此操作不可撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => onDelete(workshop.id)}
                                >
                                  确认删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailWorkshop} onOpenChange={(open) => !open && setDetailWorkshop(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailWorkshop?.name}
              {detailWorkshop && <StatusBadge status={detailWorkshop.status} />}
            </DialogTitle>
          </DialogHeader>
          {detailWorkshop && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">编号</p>
                  <p className="font-mono mt-0.5">{detailWorkshop.factory_code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">位置</p>
                  <p className="mt-0.5">{detailWorkshop.location || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">负责人</p>
                  <p className="mt-0.5">{detailWorkshop.manager || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">日产能</p>
                  <p className="mt-0.5">{detailWorkshop.capacity.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-2">产能负荷</p>
                <LoadProgress
                  value={detailWorkshop.load_percentage}
                  capacity={detailWorkshop.capacity}
                  load={detailWorkshop.current_load}
                />
              </div>
              {detailWorkshop.description && (
                <div>
                  <p className="text-muted-foreground text-xs">描述</p>
                  <p className="text-sm mt-0.5">{detailWorkshop.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FactoryList({
  data,
  viewMode,
  onStatusToggle,
  onDelete,
  isPending,
  onEditSuccess,
}: FactoryListProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Building2 className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">暂无车间数据</p>
        <p className="text-sm mt-1">点击右上方按钮添加第一个车间</p>
      </div>
    );
  }

  return viewMode === 'card' ? (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {data.map((workshop) => (
        <WorkshopCard
          key={workshop.id}
          workshop={workshop}
          onStatusToggle={onStatusToggle}
          onDelete={onDelete}
          isPending={isPending}
          onEditSuccess={onEditSuccess}
        />
      ))}
    </div>
  ) : (
    <WorkshopTable
      data={data}
      viewMode={viewMode}
      onStatusToggle={onStatusToggle}
      onDelete={onDelete}
      isPending={isPending}
      onEditSuccess={onEditSuccess}
    />
  );
}
