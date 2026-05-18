'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface WageRow {
  id: string;
  worker?: { name?: string; worker_no?: string; craft_type?: string } | null;
  task?: { task_no?: string; task_name?: string; process_name?: string } | null;
  wage_amount?: number | string;
  status?: string;
  created_at?: string;
}

function yuan(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '-';
}

export default function FinanceWagesPage() {
  const [rows, setRows] = useState<WageRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});

  const load = async () => {
    const res = await fetch('/api/finance/wages');
    const json = await res.json();
    if (json.success) {
      setRows(json.data || []);
      setSummary(json.summary || {});
    }
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const mutate = async (row: WageRow, action: 'settle' | 'pay') => {
    const res = await fetch(`/api/finance/wage-records/${row.id}/${action}`, { method: 'PATCH' });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '操作失败');
    toast.success(action === 'settle' ? '已结算' : '已发放');
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">工资结算</h1>
        <p className="text-sm text-muted-foreground">财务查看工人工资记录，并处理结算和发放状态。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Summary label="待审核" value={yuan(summary.pending)} />
        <Summary label="已确认" value={yuan(summary.approved)} />
        <Summary label="已结算" value={yuan(summary.settled)} />
        <Summary label="已发放" value={yuan(summary.paid)} />
        <Summary label="总额" value={yuan(summary.total)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">工资记录</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工人</TableHead>
                <TableHead>任务</TableHead>
                <TableHead>工序</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.worker?.worker_no} · {row.worker?.name}</TableCell>
                  <TableCell>{row.task?.task_no || row.task?.task_name || '-'}</TableCell>
                  <TableCell>{row.task?.process_name || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  <TableCell className="text-right">{yuan(row.wage_amount)}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    {row.status === 'approved' ? <Button size="sm" onClick={() => mutate(row, 'settle')}>结算</Button> : null}
                    {row.status === 'settled' ? <Button size="sm" onClick={() => mutate(row, 'pay')}>发放</Button> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
