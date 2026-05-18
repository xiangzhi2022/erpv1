'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FinanceOrder {
  id: string;
  order_no?: string;
  customer_name?: string;
  status?: string;
  total_amount?: number | string;
  cost_amount?: number | string;
  labor_cost?: number | string;
  total_cost?: number | string;
  profit?: number | string;
  receivable_amount?: number | string;
  payable_amount?: number | string;
}

function yuan(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '-';
}

export default function FinanceOrdersPage() {
  const [rows, setRows] = useState<FinanceOrder[]>([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    fetch('/api/finance/orders')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setRows(json.data || []);
      })
      .catch(() => null);
  }, []);

  const visibleRows = rows.filter((row) => {
    const text = [row.order_no, row.customer_name].filter(Boolean).join(' ').toLowerCase();
    return !keyword.trim() || text.includes(keyword.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">财务订单</h1>
          <p className="text-sm text-muted-foreground">查看订单销售额、成本、人工成本和利润。</p>
        </div>
        <Input className="md:w-80" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索订单或客户" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">订单成本与利润</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">销售金额</TableHead>
                <TableHead className="text-right">人工成本</TableHead>
                <TableHead className="text-right">总成本</TableHead>
                <TableHead className="text-right">利润</TableHead>
                <TableHead className="text-right">应收/应付</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.order_no}</TableCell>
                  <TableCell>{row.customer_name || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  <TableCell className="text-right">{yuan(row.total_amount)}</TableCell>
                  <TableCell className="text-right">{yuan(row.labor_cost)}</TableCell>
                  <TableCell className="text-right">{yuan(row.total_cost || row.cost_amount)}</TableCell>
                  <TableCell className="text-right">{yuan(row.profit)}</TableCell>
                  <TableCell className="text-right">{yuan(row.receivable_amount)} / {yuan(row.payable_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
