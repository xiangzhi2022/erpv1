'use client';

import { ArrowRight, CheckCircle, Paperclip, Printer, RotateCcw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { OrderMode } from '@/lib/order-flow';
import {
  ORDER_STATUS_CONFIG,
  type Order,
  type OrderItem,
  formatAmount,
  formatDate,
  formatShortDate,
} from '../schemas';

interface OrderDetailsSheetProps {
  order: Order | null;
  mode: OrderMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, status: string) => void;
}

function tenantName(order: Order, side: 'from' | 'to'): string {
  const tenant = side === 'from' ? order.from_tenant : order.to_tenant;
  return tenant?.company_name || tenant?.name || '-';
}

function dimensions(item: OrderItem): string {
  const parts = [item.length_mm, item.width_mm, item.thickness_mm].filter((value) => value !== null && value !== undefined && value !== '');
  return parts.length ? `${parts.join(' x ')} mm` : item.specifications || '-';
}

export function OrderDetailsSheet({ order, mode, open, onOpenChange, onStatusChange }: OrderDetailsSheetProps) {
  if (!order) return null;

  const statusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG];
  const canReceive = mode === 'factory_received' || mode === 'supplier_received';
  const canAdvanceProduction = mode === 'factory_received';
  const canCancelOutgoing = mode === 'dealer' || mode === 'factory_material';

  const handlePrint = () => {
    const printContent = document.getElementById('order-print-area');
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>订单 ${order.order_no}</title>
          <style>
            body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f5f5f5; }
            h2, h3 { margin-bottom: 8px; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const modules = order.modules.length > 0
    ? order.modules
    : [{
      id: 'legacy',
      order_id: order.id,
      module_no: `${order.order_no}-M01`,
      module_name: '历史明细',
      sort_order: 1,
      remark: null,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items: order.items,
    }];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[680px] p-0 sm:max-w-[680px]">
        <SheetHeader className="border-b p-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg">订单详情</SheetTitle>
              <SheetDescription className="mt-1 font-mono text-sm">{order.order_no}</SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1 h-4 w-4" />
              打印
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div id="order-print-area" className="space-y-6 p-6">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {statusConfig ? (
                  <Badge variant="outline" className={`${statusConfig.color} border px-3 py-1 font-medium`}>
                    <span className={`mr-2 h-2 w-2 rounded-full ${statusConfig.dotColor}`} />
                    {statusConfig.label}
                  </Badge>
                ) : null}
                <Badge variant="secondary">
                  {order.order_flow === 'factory_to_supplier' ? '工厂 -> 材料商' : order.order_flow === 'dealer_to_factory' ? '经销商 -> 工厂' : '历史订单'}
                </Badge>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-2">
                <Info label="发起企业" value={tenantName(order, 'from')} />
                <Info label="接收企业" value={tenantName(order, 'to') || order.customer_name} />
                <Info label="总金额" value={`¥${formatAmount(order.total_amount)}`} strong />
                <Info label="交付日期" value={formatShortDate(order.delivery_date)} />
                <Info label="创建时间" value={formatDate(order.created_at)} />
                <Info label="最后更新" value={formatDate(order.updated_at)} />
              </div>
              {order.parent_order ? (
                <div className="mt-4 rounded-md bg-muted p-3 text-sm">
                  关联经销商订单：<span className="font-mono">{order.parent_order.order_no}</span>
                </div>
              ) : null}
              {order.remark ? (
                <div className="mt-4 rounded-md bg-muted p-3 text-sm">{order.remark}</div>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold">层级明细</h3>
              {modules.map((module) => (
                <div key={module.id} className="rounded-lg border">
                  <div className="border-b bg-muted/40 p-3">
                    <div className="font-medium">{module.module_no} · {module.module_name}</div>
                    {module.remark ? <div className="mt-1 text-sm text-muted-foreground">{module.remark}</div> : null}
                  </div>
                  <div className="divide-y">
                    {module.items.map((item) => (
                      <div key={item.id} className="space-y-2 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs text-muted-foreground">{item.item_no || '-'}</span>
                            <div className="font-medium">{item.product_name}</div>
                          </div>
                          <div className="font-mono">¥{formatAmount(item.subtotal)}</div>
                        </div>
                        <div className="grid gap-2 text-muted-foreground md:grid-cols-3">
                          <span>规格：{dimensions(item)}</span>
                          <span>数量：{item.quantity} {item.unit || ''}</span>
                          <span>单价：¥{formatAmount(item.unit_price)}</span>
                          <span>木工：{item.woodworking_craft || '-'}</span>
                          <span>成型：{item.forming_craft || '-'}</span>
                          <span>烤漆：{item.painting_craft || '-'}</span>
                          <span>颜色：{item.color || '-'}</span>
                          <span>五金：{item.hardware || '-'} {item.hardware_quantity ? `x ${item.hardware_quantity}` : ''}</span>
                          <span>施工面：{item.construction_surface || '-'}</span>
                        </div>
                        {item.attachments && item.attachments.length > 0 ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs text-foreground hover:bg-muted/70"
                              >
                                <Paperclip className="mr-1 h-3 w-3" />
                                {attachment.file_name}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="text-right text-sm font-medium">
                合计：<span className="font-mono text-base font-bold">¥{formatAmount(order.total_amount)}</span>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="mb-3 font-semibold">快捷操作</h3>
              <div className="flex flex-wrap gap-2">
                {order.status === 'pending' && canReceive ? (
                  <>
                    <Button size="sm" onClick={() => onStatusChange(order.id, 'confirmed')}>
                      <CheckCircle className="mr-1 h-4 w-4" /> 接收订单
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onStatusChange(order.id, 'returned')}>
                      <RotateCcw className="mr-1 h-4 w-4" /> 退回
                    </Button>
                  </>
                ) : null}
                {order.status === 'confirmed' && canAdvanceProduction ? (
                  <Button size="sm" onClick={() => onStatusChange(order.id, 'pool')}>
                    <ArrowRight className="mr-1 h-4 w-4" /> 入订单池
                  </Button>
                ) : null}
                {order.status === 'pool' && canAdvanceProduction ? (
                  <Button size="sm" onClick={() => onStatusChange(order.id, 'producing')}>
                    <ArrowRight className="mr-1 h-4 w-4" /> 开始生产
                  </Button>
                ) : null}
                {order.status === 'producing' && canAdvanceProduction ? (
                  <Button size="sm" onClick={() => onStatusChange(order.id, 'shipped')}>
                    <ArrowRight className="mr-1 h-4 w-4" /> 发货
                  </Button>
                ) : null}
                {order.status === 'shipped' ? (
                  <Button size="sm" onClick={() => onStatusChange(order.id, 'completed')}>
                    <CheckCircle className="mr-1 h-4 w-4" /> 确认完成
                  </Button>
                ) : null}
                {canCancelOutgoing && (order.status === 'pending' || order.status === 'confirmed') ? (
                  <Button size="sm" variant="outline" onClick={() => onStatusChange(order.id, 'cancelled')} className="text-destructive">
                    <XCircle className="mr-1 h-4 w-4" /> 取消
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className={`mt-0.5 ${strong ? 'text-base font-semibold' : 'font-medium'}`}>{value || '-'}</p>
    </div>
  );
}
