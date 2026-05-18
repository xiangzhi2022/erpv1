'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SettlementRow {
  id: string;
  worker?: { name?: string; worker_no?: string } | null;
  wage_amount?: number | string;
  status?: string;
  approved_at?: string | null;
  paid_at?: string | null;
}

function yuan(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '-';
}

export default function FinanceSettlementsPage() {
  const [rows, setRows] = useState<SettlementRow[]>([]);

  useEffect(() => {
    fetch('/api/finance/settlements')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setRows(json.data || []);
      })
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">结算记录</h1>
        <p className="text-sm text-muted-foreground">查看已结算和已发放的工资记录。</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">结算明细</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工人</TableHead>
                <TableHead>确认时间</TableHead>
                <TableHead>发放时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.worker?.worker_no} · {row.worker?.name}</TableCell>
                  <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleDateString('zh-CN') : '-'}</TableCell>
                  <TableCell>{row.paid_at ? new Date(row.paid_at).toLocaleDateString('zh-CN') : '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  <TableCell className="text-right">{yuan(row.wage_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
