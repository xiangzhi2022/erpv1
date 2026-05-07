'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, CheckCircle, RotateCcw, ArrowRight, XCircle } from 'lucide-react';
import { Order, OrderItem, ORDER_STATUS_CONFIG, formatAmount, formatDate, formatShortDate } from '../schemas';

interface OrderDetailsSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, status: string) => void;
}

export function OrderDetailsSheet({ order, open, onOpenChange, onStatusChange }: OrderDetailsSheetProps) {
  if (!order) return null;

  const statusCfg = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG];

  const handlePrint = () => {
    const printContent = document.getElementById('order-print-area');
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>订单 ${order.order_no}</title>
              <style>
                body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
                th { background: #f5f5f5; font-weight: 600; }
                h2 { margin: 0 0 10px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
                .info-item { font-size: 13px; }
                .info-label { color: #888; }
                .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 10px; }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[540px] sm:max-w-[540px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg">订单详情</SheetTitle>
              <SheetDescription className="font-mono text-sm mt-1">{order.order_no}</SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> 打印
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-6" id="order-print-area">
            {/* Status & Basic Info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                {statusCfg && (
                  <Badge variant="outline" className={`${statusCfg.color} border font-medium px-3 py-1`}>
                    <span className={`w-2 h-2 rounded-full ${statusCfg.dotColor} mr-2`} />
                    {statusCfg.label}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">客户名称</span>
                  <p className="font-medium mt-0.5">{order.customer_name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">总金额</span>
                  <p className="font-medium mt-0.5 text-base">¥{formatAmount(order.total_amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">创建时间</span>
                  <p className="mt-0.5">{formatDate(order.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">交付日期</span>
                  <p className="mt-0.5">{formatShortDate(order.delivery_date)}</p>
                </div>
                {order.received_at && (
                  <div>
                    <span className="text-muted-foreground">接收时间</span>
                    <p className="mt-0.5">{formatDate(order.received_at)}</p>
                  </div>
                )}
              </div>
              {order.remark && (
                <div className="mt-4">
                  <span className="text-muted-foreground text-sm">备注</span>
                  <p className="text-sm mt-0.5 p-3 bg-muted rounded-md">{order.remark}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Order Items */}
            <div>
              <h3 className="font-semibold mb-3">订单明细</h3>
              {order.items && order.items.length > 0 ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">产品</TableHead>
                        <TableHead className="font-semibold">规格</TableHead>
                        <TableHead className="font-semibold text-right">数量</TableHead>
                        <TableHead className="font-semibold text-right">单价</TableHead>
                        <TableHead className="font-semibold text-right">小计</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((item: OrderItem) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.specification || '-'}</TableCell>
                          <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="text-right font-mono">¥{formatAmount(item.unit_price)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">¥{formatAmount(item.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-3 bg-muted/30 text-right text-sm font-medium">
                    合计：<span className="text-base font-bold">¥{formatAmount(order.total_amount)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无明细</p>
              )}
            </div>

            <Separator />

            {/* Status Actions */}
            <div>
              <h3 className="font-semibold mb-3">快捷操作</h3>
              <div className="flex flex-wrap gap-2">
                {order.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => onStatusChange(order.id, 'confirmed')} className="gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" /> 接收订单
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onStatusChange(order.id, 'returned')} className="gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" /> 退回
                    </Button>
                  </>
                )}
                {order.status === 'confirmed' && (
                  <Button size="sm" onClick={() => onStatusChange(order.id, 'pool')} className="gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5" /> 入订单池
                  </Button>
                )}
                {order.status === 'pool' && (
                  <Button size="sm" onClick={() => onStatusChange(order.id, 'producing')} className="gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5" /> 开始生产
                  </Button>
                )}
                {order.status === 'producing' && (
                  <Button size="sm" onClick={() => onStatusChange(order.id, 'shipped')} className="gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5" /> 发货
                  </Button>
                )}
                {order.status === 'shipped' && (
                  <Button size="sm" onClick={() => onStatusChange(order.id, 'completed')} className="gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" /> 确认完成
                  </Button>
                )}
                {(order.status === 'pending' || order.status === 'confirmed') && (
                  <Button size="sm" variant="outline" onClick={() => onStatusChange(order.id, 'cancelled')} className="gap-1.5 text-destructive">
                    <XCircle className="h-3.5 w-3.5" /> 取消
                  </Button>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
