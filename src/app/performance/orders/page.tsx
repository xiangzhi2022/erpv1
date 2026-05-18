'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface OrderPerf {
  id: string;
  order_no?: string;
  customer_name?: string;
  status?: string;
  progress_percent?: number;
  expected_delivery_date?: string | null;
  abnormal_count?: number;
  labor_cost?: number;
  order_output?: number;
}

function yuan(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '-';
}

export default function OrderPerformancePage() {
  const [rows, setRows] = useState<OrderPerf[]>([]);

  useEffect(() => {
    fetch('/api/performance/orders')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setRows(json.data || []);
      })
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">订单绩效</h1>
        <p className="text-sm text-muted-foreground">查看订单生产进度、延期风险、异常数量和人工成本。</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">订单生产绩效</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>生产进度</TableHead>
                <TableHead>预计交付</TableHead>
                <TableHead>异常数</TableHead>
                <TableHead className="text-right">人工成本</TableHead>
                <TableHead className="text-right">订单产值</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.order_no}</TableCell>
                  <TableCell>{row.customer_name || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  <TableCell>{row.progress_percent || 0}%</TableCell>
                  <TableCell>{row.expected_delivery_date || '-'}</TableCell>
                  <TableCell>{row.abnormal_count || 0}</TableCell>
                  <TableCell className="text-right">{yuan(row.labor_cost)}</TableCell>
                  <TableCell className="text-right">{yuan(row.order_output)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
